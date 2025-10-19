"""
Split Domains into 10 Equal Files
Splits unique_domains.txt into 10 files of equal size
Output files: domains_01.txt, domains_02.txt, ..., domains_10.txt
"""

from pathlib import Path
import logging
import math

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
OUTPUT_DIR = SCRIPT_DIR / "T2" / "domain_batches"
NUM_SPLITS = 10

def main():
    logger.info("="*80)
    logger.info(f"SPLITTING DOMAINS INTO {NUM_SPLITS} EQUAL FILES")
    logger.info("="*80)

    # Check if input file exists
    if not INPUT_TXT.exists():
        logger.error(f"Input file not found: {INPUT_TXT}")
        logger.error("Please run extract_domains.py first")
        return

    # Load domains
    logger.info(f"Loading domains from: {INPUT_TXT}")
    with open(INPUT_TXT, 'r') as f:
        domains = [line.strip() for line in f if line.strip()]

    total_domains = len(domains)
    logger.info(f"✓ Loaded {total_domains} domains")

    # Calculate split size
    split_size = math.ceil(total_domains / NUM_SPLITS)
    logger.info(f"✓ Split size: {split_size} domains per file")

    # Create output directory
    OUTPUT_DIR.mkdir(exist_ok=True, parents=True)
    logger.info(f"✓ Output directory: {OUTPUT_DIR}")

    # Split into files
    logger.info(f"\nSplitting into {NUM_SPLITS} files...")

    for i in range(NUM_SPLITS):
        start_idx = i * split_size
        end_idx = min(start_idx + split_size, total_domains)
        batch_domains = domains[start_idx:end_idx]

        # Create filename with zero-padded number
        output_file = OUTPUT_DIR / f"domains_{i+1:02d}.txt"

        # Write to file
        with open(output_file, 'w') as f:
            for domain in batch_domains:
                f.write(f"{domain}\n")

        logger.info(f"  ✓ {output_file.name}: {len(batch_domains)} domains (lines {start_idx+1}-{end_idx})")

    # Verification
    logger.info(f"\nVerification:")
    total_written = 0
    for i in range(NUM_SPLITS):
        output_file = OUTPUT_DIR / f"domains_{i+1:02d}.txt"
        with open(output_file, 'r') as f:
            count = sum(1 for line in f if line.strip())
        total_written += count

    logger.info(f"  Total domains written: {total_written}")
    logger.info(f"  Original domains: {total_domains}")
    logger.info(f"  Match: {'✓ Yes' if total_written == total_domains else '✗ No'}")

    logger.info("\n" + "="*80)
    logger.info(f"COMPLETE - {NUM_SPLITS} files created in {OUTPUT_DIR}")
    logger.info("="*80)

if __name__ == "__main__":
    main()
