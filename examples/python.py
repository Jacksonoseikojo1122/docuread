# Run: DOCUREAD_KEY=my-secret-key python examples/python.py eval/fixtures/invoice-gh-services.png invoice
import os, sys, requests

path = sys.argv[1] if len(sys.argv) > 1 else "eval/fixtures/receipt-gh-supermarket.png"
doc_type = sys.argv[2] if len(sys.argv) > 2 else "receipt"
url = os.environ.get("DOCUREAD_URL", "http://localhost:8787")

with open(path, "rb") as f:
    res = requests.post(
        f"{url}/v1/extract",
        headers={"Authorization": f"Bearer {os.environ.get('DOCUREAD_KEY', '')}"},
        data={"type": doc_type},
        files={"file": f},
        timeout=120,
    )
result = res.json()
print("decision:", result["decision"])
for name, f in result.get("fields", {}).items():
    mark = "✓" if f["status"] == "accepted" else "?"
    issues = f"  ({', '.join(f['issues'])})" if f["issues"] else ""
    print(f"{mark} {name:<18} {f['normalized']}{issues}")
if "reason" in result:
    print("reason:", result["reason"])
