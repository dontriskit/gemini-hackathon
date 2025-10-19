"""
LinkedIn Profile Enrichment Script
Enriches 426 LinkedIn profiles from guest_profiles.json with work emails using FullEnrich API

Strategy:
1. Load all 426 profiles from guest_profiles.json
2. Split into 5 batches (~85 profiles each)
3. Submit all 5 batches with 5-second delays between submissions
4. Poll all batches together for completion
5. Save individual batch results
6. Combine all results into one final CSV

Expected cost: ~300 credits (70% success rate × 426 profiles)
"""

import os
import json
import time
import logging
import sys
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from datetime import datetime
import pandas as pd
import requests
from dotenv import load_dotenv

# ============================================================================
# LOGGING CONFIGURATION
# ============================================================================

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s | %(levelname)-8s | %(message)s',
    datefmt='%H:%M:%S',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('enrich_linkedin.log', mode='w')
    ]
)

logger = logging.getLogger(__name__)

# ============================================================================
# CONFIGURATION
# ============================================================================

# Load environment variables
load_dotenv()

# FullEnrich API Configuration
FULLENRICH_API_BASE = "https://app.fullenrich.com/api/v1"
FULLENRICH_API_KEY = os.getenv("FULLENRICH_API_KEY", "513dc074-466f-4771-9911-9f04ae5257d5")

# File paths
SCRIPT_DIR = Path(__file__).parent
INPUT_JSON = SCRIPT_DIR / "guest_profiles_enriched.json"  # Use enriched file with LinkedIn URLs
OUTPUT_DIR = SCRIPT_DIR / "T2"

# Batch configuration
NUM_BATCHES = 5
BATCH_SUBMISSION_DELAY = 5  # 5 seconds between batch submissions

# Polling configuration
POLL_INTERVAL_SECONDS = 10  # Poll every 10 seconds
MAX_POLL_ATTEMPTS = 180  # Max 30 minutes (180 × 10s)

# Create output directory
OUTPUT_DIR.mkdir(exist_ok=True)

logger.info("="*100)
logger.info("LINKEDIN PROFILE ENRICHMENT - CEREBRAL VALLEY HACKATHON")
logger.info("="*100)
logger.info(f"API Base URL: {FULLENRICH_API_BASE}")
logger.info(f"API Key configured: {'Yes' if FULLENRICH_API_KEY != 'YOUR_API_KEY_HERE' else 'No (PLEASE SET IN .env)'}")
logger.info(f"Input JSON: {INPUT_JSON}")
logger.info(f"Output directory: {OUTPUT_DIR}")
logger.info(f"Number of batches: {NUM_BATCHES}")
logger.info(f"Batch submission delay: {BATCH_SUBMISSION_DELAY}s")
logger.info("="*100)

# ============================================================================
# API CLIENT
# ============================================================================

class FullEnrichClient:
    """FullEnrich API Client"""

    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = FULLENRICH_API_BASE
        self.headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
        logger.info("FullEnrich client initialized")

    def _make_request(self, method: str, endpoint: str, data: Optional[Dict] = None) -> Tuple[bool, Optional[Dict], Optional[str]]:
        """Make HTTP request to FullEnrich API"""
        url = f"{self.base_url}{endpoint}"

        logger.debug(f"API Request: {method} {endpoint}")

        try:
            if method == "GET":
                response = requests.get(url, headers=self.headers, timeout=30)
            elif method == "POST":
                response = requests.post(url, headers=self.headers, json=data, timeout=30)
            else:
                raise ValueError(f"Unsupported HTTP method: {method}")

            logger.debug(f"Response status: {response.status_code}")

            if response.status_code == 401:
                return False, None, "Authentication failed - check your API key"

            if response.status_code == 429:
                return False, None, "Rate limit exceeded - slow down requests"

            if response.status_code >= 400:
                return False, None, f"API error: {response.status_code} - {response.text}"

            response_data = response.json()
            return True, response_data, None

        except Exception as e:
            return False, None, f"Request error: {str(e)}"

    def get_credit_balance(self) -> Optional[int]:
        """Get current credit balance"""
        logger.info("Checking credit balance...")
        success, data, error = self._make_request("GET", "/account/credits")

        if not success:
            logger.error(f"Failed to get credit balance: {error}")
            return None

        balance = data.get("balance", 0)
        logger.info(f"✓ Current credit balance: {balance:,}")
        return balance

    def start_bulk_enrichment(self, contacts: List[Dict], enrichment_name: str) -> Optional[str]:
        """Start bulk enrichment"""
        logger.info(f"Starting enrichment: '{enrichment_name}' ({len(contacts)} contacts)")

        payload = {
            "name": enrichment_name,
            "datas": contacts
        }

        success, data, error = self._make_request("POST", "/contact/enrich/bulk", payload)

        if not success:
            logger.error(f"Failed to start enrichment: {error}")
            return None

        enrichment_id = data.get("enrichment_id")
        logger.info(f"✓ Enrichment started: {enrichment_id}")
        return enrichment_id

    def get_enrichment_results(self, enrichment_id: str) -> Optional[Dict]:
        """Get enrichment results"""
        endpoint = f"/contact/enrich/bulk/{enrichment_id}"
        success, data, error = self._make_request("GET", endpoint)

        if not success:
            logger.error(f"Failed to get results: {error}")
            return None

        return data

    def poll_batch(self, enrichment_id: str, batch_name: str) -> Optional[Dict]:
        """Poll a single batch for completion"""
        attempt = 0
        while attempt < MAX_POLL_ATTEMPTS:
            attempt += 1

            results = self.get_enrichment_results(enrichment_id)
            if results is None:
                return None

            status = results.get("status", "UNKNOWN")

            if status == "FINISHED":
                logger.info(f"  ✓ {batch_name} completed!")
                return results

            if status in ["CANCELED", "CREDITS_INSUFFICIENT", "UNKNOWN"]:
                logger.error(f"  ✗ {batch_name} failed with status: {status}")
                return None

            if status in ["CREATED", "IN_PROGRESS", "RATE_LIMIT"]:
                # Don't wait here - we'll check all batches in parallel
                return {"status": status, "in_progress": True}

            logger.warning(f"  ⚠ {batch_name} unexpected status: {status}")
            return {"status": status, "in_progress": True}

        logger.error(f"  ✗ {batch_name} polling timeout")
        return None


# ============================================================================
# DATA PROCESSING
# ============================================================================

def load_guest_profiles(json_file: Path) -> List[Dict]:
    """Load guest profiles from JSON"""
    logger.info(f"Loading guest profiles from: {json_file}")

    if not json_file.exists():
        logger.error(f"File not found: {json_file}")
        return []

    with open(json_file, 'r') as f:
        profiles = json.load(f)

    logger.info(f"✓ Loaded {len(profiles)} profiles")
    return profiles


def prepare_contact_for_api(profile: Dict) -> Optional[Dict]:
    """Prepare guest profile for FullEnrich API format"""
    # Skip if no LinkedIn URL
    linkedin_url = profile.get("linkedIn")
    if not linkedin_url:
        return None

    # Try to extract name from metadata first, fallback to name field
    metadata = profile.get("metadata", {})
    name = None

    # Check metadata fields for name
    for value in metadata.values():
        if value and isinstance(value, str) and len(value) > 2:
            name = value
            break

    # Fallback to name field if not in metadata
    if not name or name == "Unknown":
        name = profile.get("name", "Unknown")

    # Extract first and last name
    name_parts = name.strip().split(maxsplit=1)
    firstname = name_parts[0] if len(name_parts) > 0 else "Unknown"
    lastname = name_parts[1] if len(name_parts) > 1 else ""

    api_contact = {
        "firstname": firstname,
        "lastname": lastname,
        "linkedin_url": linkedin_url,  # Use the actual LinkedIn URL
        "custom": {
            "username": profile.get("username"),
            "cerebralvalley_url": profile.get("url"),
            "original_name": name
        },
        # ONLY request work emails (1 credit per contact found)
        "enrich_fields": ["contact.emails"]
    }

    return api_contact


def split_into_batches(profiles: List[Dict], num_batches: int) -> List[List[Dict]]:
    """Split profiles into roughly equal batches"""
    batch_size = (len(profiles) + num_batches - 1) // num_batches
    batches = []

    for i in range(0, len(profiles), batch_size):
        batch = profiles[i:i + batch_size]
        batches.append(batch)

    logger.info(f"Split {len(profiles)} profiles into {len(batches)} batches:")
    for i, batch in enumerate(batches, 1):
        logger.info(f"  Batch {i}: {len(batch)} profiles")

    return batches


def save_batch_results(batch_num: int, results: Dict, output_dir: Path):
    """Save individual batch results to JSON"""
    output_file = output_dir / f"batch_{batch_num}_results.json"

    with open(output_file, 'w') as f:
        json.dump(results, f, indent=2)

    logger.info(f"  💾 Saved batch {batch_num} results: {output_file.name}")


def create_enriched_dataframe(all_results: List[Dict]) -> pd.DataFrame:
    """Create enriched DataFrame from all batch results"""
    enriched_data = []

    for data in all_results:
        custom = data.get("custom", {})
        contact = data.get("contact", {})
        profile = contact.get("profile", {})
        position = profile.get("position", {})
        company = position.get("company", {})
        hq = company.get("headquarters", {})

        enriched_row = {
            # Original data
            "username": custom.get("username"),
            "original_url": custom.get("original_url"),

            # Email enrichment
            "email": contact.get("most_probable_email"),
            "email_status": contact.get("most_probable_email_status"),
            "emails_found": len(contact.get("emails", [])),
            "all_emails": json.dumps(contact.get("emails", [])),
            "domain": contact.get("domain"),

            # LinkedIn Profile
            "firstname": profile.get("firstname"),
            "lastname": profile.get("lastname"),
            "full_name": f"{profile.get('firstname', '')} {profile.get('lastname', '')}".strip(),
            "linkedin_id": profile.get("linkedin_id"),
            "linkedin_url": profile.get("linkedin_url"),
            "location": profile.get("location"),
            "headline": profile.get("headline"),
            "summary": profile.get("summary"),

            # Current Position
            "position_title": position.get("title"),
            "position_description": position.get("description"),

            # Company Data
            "company_name": company.get("name"),
            "company_linkedin_url": company.get("linkedin_url"),
            "company_website": company.get("website"),
            "company_domain": company.get("domain"),
            "company_industry": company.get("industry"),
            "company_headcount": company.get("headcount"),
            "company_headcount_range": company.get("headcount_range"),

            # Headquarters
            "hq_city": hq.get("city"),
            "hq_region": hq.get("region"),
            "hq_country": hq.get("country"),
        }
        enriched_data.append(enriched_row)

    df = pd.DataFrame(enriched_data)
    logger.info(f"✓ Created DataFrame with {len(df)} enriched profiles")
    return df


# ============================================================================
# MAIN PROCESSING
# ============================================================================

def main():
    """Main enrichment workflow"""
    start_time = datetime.now()
    logger.info(f"\nStarting enrichment at {start_time.strftime('%Y-%m-%d %H:%M:%S')}\n")

    if FULLENRICH_API_KEY == "YOUR_API_KEY_HERE":
        logger.error("⚠️  FULLENRICH_API_KEY not set in .env file!")
        logger.error("Please add: FULLENRICH_API_KEY=your_actual_key")
        sys.exit(1)

    # Initialize client
    client = FullEnrichClient(FULLENRICH_API_KEY)

    try:
        # Check credit balance
        logger.info("\n" + "="*100)
        logger.info("CHECKING CREDIT BALANCE")
        logger.info("="*100)

        balance = client.get_credit_balance()
        if balance is None:
            logger.error("Failed to check credit balance - aborting")
            return

        # Load profiles
        logger.info("\n" + "="*100)
        logger.info("LOADING GUEST PROFILES")
        logger.info("="*100)

        profiles = load_guest_profiles(INPUT_JSON)
        if not profiles:
            logger.error("No profiles loaded - aborting")
            return

        # Estimate cost
        estimated_cost = len(profiles)  # 1 credit per contact max
        estimated_actual = int(len(profiles) * 0.7)  # 70% success rate

        logger.info(f"\n📊 COST ESTIMATION:")
        logger.info(f"  Total profiles: {len(profiles)}")
        logger.info(f"  Max credits (100% success): {estimated_cost}")
        logger.info(f"  Estimated credits (70% success): {estimated_actual}")
        logger.info(f"  Current balance: {balance}")
        logger.info(f"  Balance after: ~{balance - estimated_actual}")

        if balance < estimated_cost:
            logger.warning(f"⚠️  Might be close on credits! Need ~{estimated_actual}, have {balance}")

        # Prepare contacts for API (filter out None for profiles without LinkedIn)
        api_contacts = [prepare_contact_for_api(p) for p in profiles]
        api_contacts = [c for c in api_contacts if c is not None]

        logger.info(f"✓ Prepared {len(api_contacts)} contacts for enrichment")
        logger.info(f"  Skipped {len(profiles) - len(api_contacts)} profiles without LinkedIn URLs")

        # Split into batches
        logger.info("\n" + "="*100)
        logger.info(f"SPLITTING INTO {NUM_BATCHES} BATCHES")
        logger.info("="*100)

        batches = split_into_batches(api_contacts, NUM_BATCHES)

        # Submit all batches with delays
        logger.info("\n" + "="*100)
        logger.info("SUBMITTING BATCHES")
        logger.info("="*100)

        batch_jobs = []  # Store (batch_num, enrichment_id, batch_size)

        for i, batch in enumerate(batches, 1):
            enrichment_name = f"Cerebral Valley Hackathon - Batch {i}/{len(batches)} - {datetime.now().strftime('%Y-%m-%d %H:%M')}"

            logger.info(f"\n🚀 Submitting Batch {i}/{len(batches)} ({len(batch)} profiles)...")

            enrichment_id = client.start_bulk_enrichment(batch, enrichment_name)

            if enrichment_id:
                batch_jobs.append((i, enrichment_id, len(batch)))
                logger.info(f"  ✓ Batch {i} submitted: {enrichment_id}")
            else:
                logger.error(f"  ✗ Batch {i} submission failed")

            # Delay before next batch (except last)
            if i < len(batches):
                logger.info(f"  ⏳ Waiting {BATCH_SUBMISSION_DELAY}s before next batch...")
                time.sleep(BATCH_SUBMISSION_DELAY)

        if not batch_jobs:
            logger.error("No batches submitted successfully - aborting")
            return

        logger.info(f"\n✓ Successfully submitted {len(batch_jobs)}/{len(batches)} batches")

        # Poll all batches together
        logger.info("\n" + "="*100)
        logger.info("POLLING FOR COMPLETION")
        logger.info("="*100)

        completed_batches = {}
        attempt = 0

        while len(completed_batches) < len(batch_jobs) and attempt < MAX_POLL_ATTEMPTS:
            attempt += 1
            logger.info(f"\n📊 Poll attempt {attempt}/{MAX_POLL_ATTEMPTS} - Completed: {len(completed_batches)}/{len(batch_jobs)}")

            for batch_num, enrichment_id, _ in batch_jobs:
                # Skip if already completed
                if batch_num in completed_batches:
                    continue

                batch_name = f"Batch {batch_num}"
                logger.info(f"  Checking {batch_name}...")

                results = client.poll_batch(enrichment_id, batch_name)

                if results and not results.get("in_progress"):
                    # Batch finished (success or failure)
                    completed_batches[batch_num] = results
                    save_batch_results(batch_num, results, OUTPUT_DIR)

            # Wait before next poll cycle
            if len(completed_batches) < len(batch_jobs):
                logger.info(f"  ⏳ Waiting {POLL_INTERVAL_SECONDS}s before next poll...")
                time.sleep(POLL_INTERVAL_SECONDS)

        # Check completion
        if len(completed_batches) < len(batch_jobs):
            logger.error(f"\n⚠️  Only {len(completed_batches)}/{len(batch_jobs)} batches completed")
        else:
            logger.info(f"\n✓ All {len(batch_jobs)} batches completed!")

        # Combine all results
        logger.info("\n" + "="*100)
        logger.info("COMBINING RESULTS")
        logger.info("="*100)

        all_enriched_data = []
        total_credits = 0

        for batch_num in sorted(completed_batches.keys()):
            results = completed_batches[batch_num]
            batch_data = results.get("datas", [])
            batch_credits = results.get("cost", {}).get("credits", 0)

            all_enriched_data.extend(batch_data)
            total_credits += batch_credits

            logger.info(f"  Batch {batch_num}: {len(batch_data)} profiles, {batch_credits} credits")

        logger.info(f"\n✓ Total: {len(all_enriched_data)} enriched profiles, {total_credits} credits used")

        # Create final CSV
        logger.info("\n" + "="*100)
        logger.info("CREATING FINAL CSV")
        logger.info("="*100)

        df = create_enriched_dataframe(all_enriched_data)

        # Calculate stats
        emails_found = df["email"].notna().sum()
        success_rate = (emails_found / len(df) * 100) if len(df) > 0 else 0

        logger.info(f"\n📊 ENRICHMENT STATS:")
        logger.info(f"  Total profiles: {len(df)}")
        logger.info(f"  Emails found: {emails_found} ({success_rate:.1f}%)")
        logger.info(f"  Deliverable: {(df['email_status'] == 'DELIVERABLE').sum()}")
        logger.info(f"  High probability: {(df['email_status'] == 'HIGH_PROBABILITY').sum()}")
        logger.info(f"  Credits used: {total_credits}")

        # Save CSV
        output_csv = OUTPUT_DIR / "cerebralvalley_hackathon_enriched.csv"
        df.to_csv(output_csv, index=False)
        logger.info(f"\n✓ Final CSV saved: {output_csv}")

        # Save summary JSON
        summary = {
            "timestamp": start_time.isoformat(),
            "total_profiles": len(df),
            "emails_found": int(emails_found),
            "success_rate": float(success_rate),
            "credits_used": total_credits,
            "batches_processed": len(completed_batches),
            "duration_minutes": (datetime.now() - start_time).total_seconds() / 60
        }

        summary_file = OUTPUT_DIR / "enrichment_summary.json"
        with open(summary_file, 'w') as f:
            json.dump(summary, f, indent=2)

        logger.info(f"✓ Summary saved: {summary_file}")

        # Final message
        end_time = datetime.now()
        elapsed = (end_time - start_time).total_seconds() / 60

        logger.info("\n" + "="*100)
        logger.info("ENRICHMENT COMPLETE")
        logger.info("="*100)
        logger.info(f"Total time: {elapsed:.1f} minutes")
        logger.info(f"Results saved to: {OUTPUT_DIR}")
        logger.info("="*100)

    except Exception as e:
        logger.error(f"Enrichment failed: {str(e)}", exc_info=True)
        raise


if __name__ == "__main__":
    logger.info("\n")
    logger.info("╔════════════════════════════════════════════════════════════════════════════╗")
    logger.info("║        CEREBRAL VALLEY HACKATHON - LINKEDIN ENRICHMENT                     ║")
    logger.info("║                     426 Profiles → Work Emails                             ║")
    logger.info("╚════════════════════════════════════════════════════════════════════════════╝")
    logger.info("\n")

    main()
