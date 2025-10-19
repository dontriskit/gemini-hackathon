"""
Clean and Deduplicate Domains
- Removes URL parameters (everything after ?)
- Removes duplicates
- Validates domain format
- Overwrites unique_domains.txt with cleaned version
"""

from pathlib import Path
import logging
import re

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s | %(levelname)-8s | %(message)s',
    datefmt='%H:%M:%S'
)
logger = logging.getLogger(__name__)

# Configuration
SCRIPT_DIR = Path(__file__).parent
INPUT_TXT = SCRIPT_DIR / "T2" / "unique_domains.txt"
OUTPUT_TXT = SCRIPT_DIR / "T2" / "unique_domains_cleaned.txt"

def clean_domain(domain: str) -> str:
    """Clean a domain string"""
    if not domain:
        return None

    # Remove whitespace
    domain = domain.strip()

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
    domain = domain.replace('www.', '')

    # Remove any path (everything after first /)
    if '/' in domain:
        domain = domain.split('/')[0]

    # Convert to lowercase
    domain = domain.lower().strip()

    return domain if domain else None

def is_valid_domain(domain: str) -> bool:
    """Validate domain format"""
    if not domain:
        return False

    # Must contain at least one dot
    if '.' not in domain:
        return False

    # Must be at least 4 characters (e.g., a.co)
    if len(domain) < 4:
        return False

    # Should not contain spaces
    if ' ' in domain:
        return False

    # Should not contain special characters (except dots and hyphens)
    if not re.match(r'^[a-z0-9.-]+$', domain):
        return False

    # Should not start or end with dot or hyphen
    if domain.startswith('.') or domain.startswith('-'):
        return False
    if domain.endswith('.') or domain.endswith('-'):
        return False

    # Should have valid TLD (at least 2 chars after last dot)
    parts = domain.split('.')
    if len(parts[-1]) < 2:
        return False

    return True

def main():
    logger.info("="*80)
    logger.info("CLEANING AND DEDUPLICATING DOMAINS")
    logger.info("="*80)

    # Check if input file exists
    if not INPUT_TXT.exists():
        logger.error(f"Input file not found: {INPUT_TXT}")
        logger.error("Please run extract_domains.py first")
        return

    # Load domains
    logger.info(f"Loading domains from: {INPUT_TXT}")
    with open(INPUT_TXT, 'r') as f:
        original_domains = [line.strip() for line in f if line.strip()]

    logger.info(f"✓ Loaded {len(original_domains)} original domains")

    # Clean domains
    logger.info("\nCleaning domains...")
    cleaned_domains = set()
    invalid_count = 0
    duplicate_count = 0
    cleaned_count = 0

    # Track what was cleaned
    url_params_removed = []
    invalids = []

    for domain in original_domains:
        cleaned = clean_domain(domain)

        if cleaned != domain:
            cleaned_count += 1
            if '?' in domain:
                url_params_removed.append(f"{domain} → {cleaned}")

        if not is_valid_domain(cleaned):
            invalid_count += 1
            invalids.append(cleaned)
            continue

        if cleaned in cleaned_domains:
            duplicate_count += 1
        else:
            cleaned_domains.add(cleaned)

    # Sort domains
    sorted_domains = sorted(cleaned_domains)

    logger.info(f"\n📊 Cleaning Statistics:")
    logger.info(f"  Original domains: {len(original_domains)}")
    logger.info(f"  Cleaned/modified: {cleaned_count}")
    logger.info(f"  URL parameters removed: {len(url_params_removed)}")
    logger.info(f"  Invalid domains removed: {invalid_count}")
    logger.info(f"  Duplicates removed: {duplicate_count}")
    logger.info(f"  Final unique domains: {len(sorted_domains)}")
    logger.info(f"  Reduction: {len(original_domains) - len(sorted_domains)} domains")

    # Show examples of URL parameter removals
    if url_params_removed:
        logger.info(f"\nURL Parameters Removed (showing first 5):")
        for example in url_params_removed[:5]:
            logger.info(f"  - {example}")
        if len(url_params_removed) > 5:
            logger.info(f"  ... and {len(url_params_removed) - 5} more")

    # Show invalid domains
    if invalids:
        logger.info(f"\nInvalid Domains Removed (showing first 5):")
        for example in invalids[:5]:
            logger.info(f"  - {example}")
        if len(invalids) > 5:
            logger.info(f"  ... and {len(invalids) - 5} more")

    # Save cleaned domains
    logger.info(f"\nSaving cleaned domains to: {OUTPUT_TXT}")
    with open(OUTPUT_TXT, 'w') as f:
        for domain in sorted_domains:
            f.write(f"{domain}\n")

    logger.info(f"✓ Saved {len(sorted_domains)} cleaned domains")

    # Also overwrite the original file
    logger.info(f"Overwriting original file: {INPUT_TXT}")
    with open(INPUT_TXT, 'w') as f:
        for domain in sorted_domains:
            f.write(f"{domain}\n")

    logger.info(f"✓ Original file updated")

    # Show sample of cleaned domains
    logger.info(f"\nSample cleaned domains (first 10):")
    for domain in sorted_domains[:10]:
        logger.info(f"  - {domain}")

    logger.info("\n" + "="*80)
    logger.info(f"COMPLETE - {len(sorted_domains)} clean unique domains")
    logger.info("="*80)
    logger.info("\nNext step: Run split_domains.py to create 10 batches")

if __name__ == "__main__":
    main()
