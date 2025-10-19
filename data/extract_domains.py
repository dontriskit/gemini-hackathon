"""
Extract Unique Domains from Enriched CSV
Extracts all unique company domains and email domains from the enriched profiles
Saves to unique_domains.txt
"""

import pandas as pd
from pathlib import Path
import logging

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s | %(levelname)-8s | %(message)s',
    datefmt='%H:%M:%S'
)
logger = logging.getLogger(__name__)

# Configuration
SCRIPT_DIR = Path(__file__).parent
INPUT_CSV = SCRIPT_DIR / "T2" / "cerebralvalley_hackathon_enriched.csv"
OUTPUT_TXT = SCRIPT_DIR / "T2" / "unique_domains.txt"

def extract_domain_from_email(email: str) -> str:
    """Extract domain from email address"""
    if pd.isna(email) or not email:
        return None

    if '@' in email:
        return email.split('@')[1].strip().lower()

    return None

def main():
    logger.info("="*80)
    logger.info("EXTRACTING UNIQUE DOMAINS FROM ENRICHED PROFILES")
    logger.info("="*80)

    # Check if input file exists
    if not INPUT_CSV.exists():
        logger.error(f"Input file not found: {INPUT_CSV}")
        logger.error("Please run enrich_linkedin.py first")
        return

    # Load CSV
    logger.info(f"Loading CSV: {INPUT_CSV}")
    df = pd.read_csv(INPUT_CSV)
    logger.info(f"✓ Loaded {len(df)} profiles")

    # Extract domains from multiple sources
    domains = set()

    # 1. Company domains (from enriched company data)
    if 'company_domain' in df.columns:
        company_domains = df['company_domain'].dropna().str.strip().str.lower()
        domains.update(company_domains.tolist())
        logger.info(f"  Found {len(company_domains.unique())} unique company domains")

    # 2. Email domains (from enriched emails)
    if 'domain' in df.columns:
        email_domains = df['domain'].dropna().str.strip().str.lower()
        domains.update(email_domains.tolist())
        logger.info(f"  Found {len(email_domains.unique())} unique email domains")

    # 3. Extract domains from email addresses directly
    if 'email' in df.columns:
        extracted_domains = df['email'].apply(extract_domain_from_email).dropna()
        domains.update(extracted_domains.tolist())
        logger.info(f"  Extracted {len(extracted_domains.unique())} domains from email addresses")

    # 4. Company website domains (extract domain from full URL)
    if 'company_website' in df.columns:
        website_domains = df['company_website'].dropna()
        for url in website_domains:
            if pd.notna(url) and isinstance(url, str):
                # Remove protocol
                domain = url.replace('https://', '').replace('http://', '')
                # Remove www.
                domain = domain.replace('www.', '')
                # Remove path
                domain = domain.split('/')[0].strip().lower()
                if domain:
                    domains.add(domain)
        logger.info(f"  Extracted {len(website_domains.unique())} domains from company websites")

    # Remove invalid domains
    domains = {d for d in domains if d and '.' in d and len(d) > 3}

    # Sort domains
    sorted_domains = sorted(domains)

    logger.info(f"\n✓ Total unique domains: {len(sorted_domains)}")

    # Save to file
    OUTPUT_TXT.parent.mkdir(exist_ok=True)
    with open(OUTPUT_TXT, 'w') as f:
        for domain in sorted_domains:
            f.write(f"{domain}\n")

    logger.info(f"✓ Saved to: {OUTPUT_TXT}")

    # Show sample
    logger.info(f"\nSample domains (first 10):")
    for domain in sorted_domains[:10]:
        logger.info(f"  - {domain}")

    logger.info("\n" + "="*80)
    logger.info(f"COMPLETE - {len(sorted_domains)} unique domains extracted")
    logger.info("="*80)

if __name__ == "__main__":
    main()
