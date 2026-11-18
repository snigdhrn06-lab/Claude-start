"""Fetch the public datasets and verify their checksums.

1. Bread Basket (the hero bakery's real normal).
2. Real honest shops for the out-of-sample false-alarm test (see pulse/real_shops.py):
   Olist's public marketplace data (from Olist's own GitHub repo) and UCI Online Retail (a public mirror).

The canonical source is Kaggle ("Transactions from a bakery", file BreadBasket_DMS.csv).
Kaggle needs a login, so we fetch the identical file from public GitHub mirrors and
verify the MD5 so that no altered copy is ever used.
"""
import hashlib
import pathlib
import sys
import urllib.request

EXPECTED_MD5 = "e7b15b10c254d373ffbf1c1659122a55"
MIRRORS = [
    "https://raw.githubusercontent.com/viktree/curly-octo-chainsaw/master/BreadBasket_DMS.csv",
    "https://raw.githubusercontent.com/fenago/datasets/main/BreadBasket_DMS.csv",
]
DEST = pathlib.Path(__file__).resolve().parents[1] / "data" / "raw" / "bread_basket.csv"
OLIST = "https://raw.githubusercontent.com/olist/work-at-olist-data/master/datasets/"
REAL_SHOPS = {  # file -> (url, md5)
    "olist_orders_dataset.csv": (OLIST + "olist_orders_dataset.csv", "8bd60e55c1ca229d9f70b62f3e72f22c"),
    "olist_order_items_dataset.csv": (OLIST + "olist_order_items_dataset.csv", "791f009968e979c9d1cffdd17146403d"),
    "olist_customers_dataset.csv": (OLIST + "olist_customers_dataset.csv", "e585d546a08f221c310b85884fb74f4d"),
    "olist_sellers_dataset.csv": (OLIST + "olist_sellers_dataset.csv", "0a0949f31a8adb0914ba3e30486c52c8"),
    "online_retail.csv": ("https://raw.githubusercontent.com/databricks/Spark-The-Definitive-Guide/master/data/retail-data/all/"
                          "online-retail-dataset.csv", "b892492f3285e2e8490fa6467be88f0b"),
}


def fetch_real_shops() -> None:
    """Optional: without these files the pipeline still runs, just without the real-shop test."""
    for name, (url, want) in REAL_SHOPS.items():
        dest = DEST.parent / name
        if dest.exists():
            print(f"OK  {dest.name} already present")
            continue
        try:
            data = urllib.request.urlopen(url, timeout=120).read()
        except Exception as e:  # noqa: BLE001
            print(f"     real-shop file failed: {name} ({e}); the real-shop test will skip it")
            continue
        if md5(data) != want:
            print(f"     checksum mismatch for {name}; skipped")
            continue
        dest.write_bytes(data)
        print(f"OK  saved {dest.name} (md5 verified)")


def md5(b: bytes) -> str:
    return hashlib.md5(b).hexdigest()


def main() -> int:
    DEST.parent.mkdir(parents=True, exist_ok=True)
    fetch_real_shops()
    if DEST.exists():
        got = md5(DEST.read_bytes())
        if got == EXPECTED_MD5:
            print(f"OK  {DEST} already present (md5 {got})")
            return 0
        print(f"WARN {DEST} exists but md5 is {got}, expected {EXPECTED_MD5}. Using it anyway (your copy).")
        return 0
    for url in MIRRORS:
        try:
            data = urllib.request.urlopen(url, timeout=30).read()
        except Exception as e:  # noqa: BLE001
            print(f"     mirror failed: {url} ({e})")
            continue
        if md5(data) != EXPECTED_MD5:
            print(f"     checksum mismatch from {url}; skipped")
            continue
        DEST.parent.mkdir(parents=True, exist_ok=True)
        DEST.write_bytes(data)
        print(f"OK  saved {DEST} from {url} (md5 verified)")
        return 0
    print(
        "MISSING DATASET. Download 'BreadBasket_DMS.csv' from Kaggle\n"
        "  (https://www.kaggle.com/datasets/sulmansarwar/transactions-from-a-bakery)\n"
        f"  and save it as {DEST}"
    )
    return 1


if __name__ == "__main__":
    sys.exit(main())
