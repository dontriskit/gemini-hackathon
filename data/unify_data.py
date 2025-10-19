"""
Unified Guest Data Generator
Combines Cerebral Valley guest profiles with FullEnrich LinkedIn data and WhiteContext company intelligence.

Data Flow:
1. Load 424 Cerebral Valley guests (guest_profiles_enriched.json)
2. Load 414 FullEnrich profiles (batch_1_results.json - batch_5_results.json)
3. Load 344 WhiteContext companies (whitecontext/1.json - whitecontext/10.json)
4. Join by username (CV → FullEnrich) and domain (FullEnrich → WhiteContext)
5. Generate unified JSON files

Outputs:
- unified_guests_all.json - All 424 guests with available enrichment
- unified_guests_whitecontext.json - Only guests with company intelligence
- unification_report.json - Statistics and data quality metrics
"""

import json
import logging
import sys
from pathlib import Path
from typing import Dict, List, Optional
from datetime import datetime
from collections import defaultdict

# ============================================================================
# LOGGING CONFIGURATION
# ============================================================================

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s | %(levelname)-8s | %(message)s',
    datefmt='%H:%M:%S',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('unification.log', mode='w')
    ]
)

logger = logging.getLogger(__name__)

# ============================================================================
# CONFIGURATION
# ============================================================================

SCRIPT_DIR = Path(__file__).parent
GUEST_PROFILES_FILE = SCRIPT_DIR / "guest_profiles_enriched.json"
FULLENRICH_DIR = SCRIPT_DIR / "T2"
WHITECONTEXT_DIR = SCRIPT_DIR / "whitecontext"

OUTPUT_ALL = SCRIPT_DIR / "unified_guests_all.json"
OUTPUT_WHITECONTEXT = SCRIPT_DIR / "unified_guests_whitecontext.json"
OUTPUT_REPORT = SCRIPT_DIR / "unification_report.json"

logger.info("="*100)
logger.info("CEREBRAL VALLEY HACKATHON - UNIFIED GUEST DATA GENERATOR")
logger.info("="*100)
logger.info(f"Guest profiles: {GUEST_PROFILES_FILE}")
logger.info(f"FullEnrich data: {FULLENRICH_DIR}")
logger.info(f"WhiteContext data: {WHITECONTEXT_DIR}")
logger.info("="*100)

# ============================================================================
# DOMAIN NORMALIZATION
# ============================================================================

def normalize_domain(domain: str) -> Optional[str]:
    """
    Normalize domain for matching (same logic as clean_domains.py)
    """
    if not domain or not isinstance(domain, str):
        return None

    # Remove whitespace
    domain = domain.strip()

    if not domain:
        return None

    # Remove URL parameters (everything after ?)
    if '?' in domain:
        domain = domain.split('?')[0]

    # Remove URL fragments (everything after #)
    if '#' in domain:
        domain = domain.split('#')[0]

    # Remove trailing slashes
    domain = domain.rstrip('/')

    # Remove protocol if present
    domain = domain.replace('https://', '').replace('http://', '')

    # Remove www. prefix
    if domain.startswith('www.'):
        domain = domain[4:]

    # Remove any path (everything after first /)
    if '/' in domain:
        domain = domain.split('/')[0]

    # Convert to lowercase
    domain = domain.lower().strip()

    # Basic validation
    if not domain or '.' not in domain or len(domain) < 4:
        return None

    return domain

# ============================================================================
# DATA LOADERS
# ============================================================================

def load_guest_profiles() -> List[Dict]:
    """Load Cerebral Valley guest profiles"""
    logger.info("\n" + "="*100)
    logger.info("LOADING CEREBRAL VALLEY GUEST PROFILES")
    logger.info("="*100)

    if not GUEST_PROFILES_FILE.exists():
        logger.error(f"Guest profiles file not found: {GUEST_PROFILES_FILE}")
        return []

    with open(GUEST_PROFILES_FILE, 'r') as f:
        profiles = json.load(f)

    logger.info(f"✓ Loaded {len(profiles)} guest profiles")
    return profiles


def load_fullenrich_data() -> Dict[str, Dict]:
    """Load all FullEnrich batch results and index by username"""
    logger.info("\n" + "="*100)
    logger.info("LOADING FULLENRICH DATA")
    logger.info("="*100)

    fullenrich_by_username = {}
    batch_files = sorted(FULLENRICH_DIR.glob("batch_*_results.json"))

    if not batch_files:
        logger.warning(f"No FullEnrich batch files found in {FULLENRICH_DIR}")
        return {}

    total_loaded = 0
    for batch_file in batch_files:
        with open(batch_file, 'r') as f:
            batch_data = json.load(f)

        datas = batch_data.get("datas", [])
        logger.info(f"  {batch_file.name}: {len(datas)} profiles")

        for item in datas:
            custom = item.get("custom", {})
            username = custom.get("username")

            if username:
                fullenrich_by_username[username] = item
                total_loaded += 1

    logger.info(f"✓ Loaded {total_loaded} FullEnrich profiles")
    return fullenrich_by_username


def load_whitecontext_data() -> Dict[str, Dict]:
    """Load all WhiteContext results and index by normalized domain"""
    logger.info("\n" + "="*100)
    logger.info("LOADING WHITECONTEXT DATA")
    logger.info("="*100)

    whitecontext_by_domain = {}
    wc_files = sorted(WHITECONTEXT_DIR.glob("*.json"))

    if not wc_files:
        logger.warning(f"No WhiteContext files found in {WHITECONTEXT_DIR}")
        return {}

    total_loaded = 0
    total_completed = 0

    for wc_file in wc_files:
        with open(wc_file, 'r') as f:
            wc_data = json.load(f)

        results = wc_data.get("results", [])
        completed = sum(1 for r in results if r.get("status") == "completed")

        logger.info(f"  {wc_file.name}: {len(results)} companies ({completed} completed)")

        for result in results:
            if result.get("status") != "completed":
                continue

            url = result.get("url")
            normalized = normalize_domain(url)

            if normalized:
                # Store the entire result (includes gtm_intelligence)
                whitecontext_by_domain[normalized] = result
                total_loaded += 1
                total_completed += 1

    logger.info(f"✓ Loaded {total_loaded} WhiteContext companies (all completed)")
    return whitecontext_by_domain


# ============================================================================
# DOMAIN EXTRACTION
# ============================================================================

def extract_domain_from_fullenrich(fullenrich_data: Dict) -> Optional[str]:
    """
    Extract and normalize domain from FullEnrich data.
    Priority: company.domain > company.website > contact.domain
    """
    contact = fullenrich_data.get("contact", {})
    profile = contact.get("profile", {})
    position = profile.get("position", {})
    company = position.get("company", {})

    # Try company domain first
    domain = company.get("domain")
    if domain:
        normalized = normalize_domain(domain)
        if normalized:
            return normalized

    # Try company website
    website = company.get("website")
    if website:
        normalized = normalize_domain(website)
        if normalized:
            return normalized

    # Try contact domain (email domain)
    contact_domain = contact.get("domain")
    if contact_domain:
        normalized = normalize_domain(contact_domain)
        if normalized:
            return normalized

    return None


# ============================================================================
# UNIFIED DATA BUILDER
# ============================================================================

def build_unified_profile(
    guest: Dict,
    fullenrich_data: Optional[Dict],
    whitecontext_data: Optional[Dict]
) -> Dict:
    """Build unified profile from all data sources"""

    username = guest.get("username")

    # Base structure
    unified = {
        "username": username,
        "cerebralvalley": {
            "url": guest.get("url"),
            "name": guest.get("name"),
            "avatar": guest.get("avatar"),
            "metadata": guest.get("metadata", {})
        },
        "linkedin": {},
        "contact": {},
        "position": {},
        "company": {},
        "whitecontext": {},
        "data_completeness": {
            "has_linkedin": bool(guest.get("linkedIn")),
            "has_fullenrich": False,
            "has_whitecontext": False,
            "has_email": False,
            "has_company": False
        }
    }

    # Add LinkedIn URL from guest data
    linkedin_url = guest.get("linkedIn")
    if linkedin_url:
        unified["linkedin"]["url"] = linkedin_url

    # Add FullEnrich data if available
    if fullenrich_data:
        contact = fullenrich_data.get("contact", {})
        profile = contact.get("profile", {})
        position = profile.get("position", {})
        company = position.get("company", {})

        # LinkedIn profile data
        unified["linkedin"].update({
            "profile_id": profile.get("linkedin_id"),
            "profile_url": profile.get("linkedin_url"),
            "handle": profile.get("linkedin_handle"),
            "firstname": profile.get("firstname"),
            "lastname": profile.get("lastname"),
            "location": profile.get("location"),
            "headline": profile.get("headline"),
            "summary": profile.get("summary"),
            "premium_account": profile.get("premium_account")
        })

        # Contact data
        unified["contact"] = {
            "email": contact.get("most_probable_email"),
            "email_status": contact.get("most_probable_email_status"),
            "domain": contact.get("domain"),
            "all_emails": contact.get("emails", []),
            "phones": contact.get("phones", []),
            "social_medias": contact.get("social_medias", [])
        }

        # Position data
        unified["position"] = {
            "title": position.get("title"),
            "description": position.get("description"),
            "start_date": position.get("start_at"),
            "end_date": position.get("end_at")
        }

        # Company data
        hq = company.get("headquarters", {})
        unified["company"] = {
            "name": company.get("name"),
            "domain": company.get("domain"),
            "website": company.get("website"),
            "linkedin_url": company.get("linkedin_url"),
            "linkedin_id": company.get("linkedin_id"),
            "industry": company.get("industry"),
            "description": company.get("description"),
            "headcount": company.get("headcount"),
            "headcount_range": company.get("headcount_range"),
            "year_founded": company.get("year_founded"),
            "headquarters": {
                "city": hq.get("city"),
                "region": hq.get("region"),
                "country": hq.get("country"),
                "country_code": hq.get("country_code"),
                "address": hq.get("address_line_1")
            }
        }

        # Update completeness flags
        unified["data_completeness"]["has_fullenrich"] = True
        unified["data_completeness"]["has_email"] = bool(contact.get("most_probable_email"))
        unified["data_completeness"]["has_company"] = bool(company.get("name"))

    # Add WhiteContext data if available
    if whitecontext_data:
        gtm = whitecontext_data.get("gtm_intelligence", {})

        unified["whitecontext"] = {
            "enriched": True,
            "analyzed_at": whitecontext_data.get("analyzed_at"),
            "source_url": whitecontext_data.get("url"),
            "company_name": whitecontext_data.get("company_name"),
            "tldr": gtm.get("tldr"),
            "context_tags": gtm.get("context_tags", []),
            "business_model": gtm.get("business_model", {}),
            "company_profile": gtm.get("company_profile", {}),
            "products_services": gtm.get("products_services", []),
            "technology_profile": gtm.get("technology_profile", {}),
            "market_evidence": gtm.get("market_evidence", {}),
            "contact_information": gtm.get("contact_information", {}),
            "company_intelligence": gtm.get("company_intelligence", {}),
            "recognition_credibility": gtm.get("recognition_credibility", {}),
            "intelligence_gaps": gtm.get("intelligence_gaps", [])
        }

        unified["data_completeness"]["has_whitecontext"] = True
    else:
        unified["whitecontext"]["enriched"] = False

    return unified


# ============================================================================
# MAIN UNIFICATION LOGIC
# ============================================================================

def unify_all_data() -> tuple[List[Dict], Dict]:
    """Main unification logic"""

    # Load all data
    guests = load_guest_profiles()
    fullenrich_by_username = load_fullenrich_data()
    whitecontext_by_domain = load_whitecontext_data()

    if not guests:
        logger.error("No guest profiles loaded - aborting")
        return [], {}

    # Statistics
    stats = {
        "total_guests": len(guests),
        "with_linkedin_url": 0,
        "with_fullenrich": 0,
        "with_whitecontext": 0,
        "with_email": 0,
        "with_company": 0,
        "domain_matches": 0,
        "domain_mismatches": 0,
        "unmatched_domains": [],
        "timestamp": datetime.now().isoformat()
    }

    # Build unified profiles
    logger.info("\n" + "="*100)
    logger.info("UNIFYING DATA")
    logger.info("="*100)

    unified_profiles = []

    for i, guest in enumerate(guests, 1):
        username = guest.get("username")

        if i % 50 == 0:
            logger.info(f"  Processing: {i}/{len(guests)} guests...")

        # Get FullEnrich data
        fullenrich_data = fullenrich_by_username.get(username)

        # Extract and normalize domain
        domain = None
        whitecontext_data = None

        if fullenrich_data:
            domain = extract_domain_from_fullenrich(fullenrich_data)

            if domain:
                # Try to find WhiteContext data
                whitecontext_data = whitecontext_by_domain.get(domain)

                if whitecontext_data:
                    stats["domain_matches"] += 1
                else:
                    stats["domain_mismatches"] += 1
                    stats["unmatched_domains"].append({
                        "username": username,
                        "domain": domain
                    })

        # Build unified profile
        unified = build_unified_profile(guest, fullenrich_data, whitecontext_data)
        unified_profiles.append(unified)

        # Update stats
        if unified["linkedin"].get("url"):
            stats["with_linkedin_url"] += 1
        if unified["data_completeness"]["has_fullenrich"]:
            stats["with_fullenrich"] += 1
        if unified["data_completeness"]["has_whitecontext"]:
            stats["with_whitecontext"] += 1
        if unified["data_completeness"]["has_email"]:
            stats["with_email"] += 1
        if unified["data_completeness"]["has_company"]:
            stats["with_company"] += 1

    logger.info(f"✓ Unified {len(unified_profiles)} profiles")

    return unified_profiles, stats


# ============================================================================
# SAVE OUTPUTS
# ============================================================================

def save_outputs(unified_profiles: List[Dict], stats: Dict):
    """Save unified data and reports"""
    logger.info("\n" + "="*100)
    logger.info("SAVING OUTPUTS")
    logger.info("="*100)

    # Save all unified profiles
    with open(OUTPUT_ALL, 'w') as f:
        json.dump(unified_profiles, f, indent=2)
    logger.info(f"✓ Saved all {len(unified_profiles)} profiles: {OUTPUT_ALL.name}")

    # Filter and save only profiles with WhiteContext data
    with_whitecontext = [p for p in unified_profiles if p["data_completeness"]["has_whitecontext"]]
    with open(OUTPUT_WHITECONTEXT, 'w') as f:
        json.dump(with_whitecontext, f, indent=2)
    logger.info(f"✓ Saved {len(with_whitecontext)} profiles with WhiteContext: {OUTPUT_WHITECONTEXT.name}")

    # Save statistics report
    with open(OUTPUT_REPORT, 'w') as f:
        json.dump(stats, f, indent=2)
    logger.info(f"✓ Saved statistics report: {OUTPUT_REPORT.name}")


def print_statistics(stats: Dict):
    """Print unification statistics"""
    logger.info("\n" + "="*100)
    logger.info("UNIFICATION STATISTICS")
    logger.info("="*100)

    total = stats["total_guests"]

    logger.info(f"\n📊 Data Coverage:")
    logger.info(f"  Total guests: {total}")
    logger.info(f"  With LinkedIn URL: {stats['with_linkedin_url']} ({stats['with_linkedin_url']/total*100:.1f}%)")
    logger.info(f"  With FullEnrich data: {stats['with_fullenrich']} ({stats['with_fullenrich']/total*100:.1f}%)")
    logger.info(f"  With WhiteContext data: {stats['with_whitecontext']} ({stats['with_whitecontext']/total*100:.1f}%)")
    logger.info(f"  With email: {stats['with_email']} ({stats['with_email']/total*100:.1f}%)")
    logger.info(f"  With company info: {stats['with_company']} ({stats['with_company']/total*100:.1f}%)")

    logger.info(f"\n🔗 Domain Matching:")
    logger.info(f"  Successful matches: {stats['domain_matches']}")
    logger.info(f"  Unmatched domains: {stats['domain_mismatches']}")

    if stats['domain_mismatches'] > 0:
        logger.info(f"\n⚠️  Sample unmatched domains (first 10):")
        for item in stats['unmatched_domains'][:10]:
            logger.info(f"    {item['username']}: {item['domain']}")
        if stats['domain_mismatches'] > 10:
            logger.info(f"    ... and {stats['domain_mismatches'] - 10} more")

    logger.info("\n" + "="*100)
    logger.info("UNIFICATION COMPLETE")
    logger.info("="*100)
    logger.info(f"\nOutputs:")
    logger.info(f"  All guests: {OUTPUT_ALL}")
    logger.info(f"  With WhiteContext: {OUTPUT_WHITECONTEXT}")
    logger.info(f"  Statistics: {OUTPUT_REPORT}")
    logger.info("="*100)


# ============================================================================
# MAIN
# ============================================================================

def main():
    """Main execution"""
    try:
        logger.info("\n")
        logger.info("╔════════════════════════════════════════════════════════════════════════════╗")
        logger.info("║        CEREBRAL VALLEY HACKATHON - UNIFIED GUEST DATABASE                 ║")
        logger.info("║     Guest Profiles + FullEnrich + WhiteContext → Unified JSON             ║")
        logger.info("╚════════════════════════════════════════════════════════════════════════════╝")
        logger.info("\n")

        # Run unification
        unified_profiles, stats = unify_all_data()

        if not unified_profiles:
            logger.error("No profiles unified - aborting")
            return

        # Save outputs
        save_outputs(unified_profiles, stats)

        # Print statistics
        print_statistics(stats)

    except Exception as e:
        logger.error(f"Unification failed: {str(e)}", exc_info=True)
        raise


if __name__ == "__main__":
    main()
