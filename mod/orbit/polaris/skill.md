Your API key (save this somewhere safe, it's shown once):
  pi_sk_0mfZy3todHVm6ay_Vzp-h8vhQhiSgz7DpuzqC5vZoBc

  You have $25 in credits to start. That's ~14 hours on a V100 or ~8 hours on an H100.

  Full API docs:
  https://gist.github.com/wallscaler/e528727e17147fc0d644fae4bc5c2dcf

  Quick start -- copy paste this:
  export POLARIS_KEY="pi_sk_0mfZy3todHVm6ay_Vzp-h8vhQhiSgz7DpuzqC5vZoBc"

  # See what's available
  curl -s https://api.polaris.computer/api/compute/gpus | python3 -m json.tool

  # Check your balance
  curl -s -H "Authorization: Bearer $POLARIS_KEY" https://api.polaris.computer/api/billing/credits

  # Rent a GPU (swap gpu_type for whatever you want, pass your SSH public key)
  curl -s -X POST \
    -H "Authorization: Bearer $POLARIS_KEY" \
    -H "Content-Type: application/json" \
    -d '{
      "name": "my-box",
      "gpu_type": "H100 SXM5 80GB",
      "ssh_public_key": "ssh-ed25519 AAAA... your-key-here",
      "use_spot": true
    }' \
    https://api.polaris.computer/api/compute/instances

  # Wait ~2 min, then check for IP
  curl -s -H "Authorization: Bearer $POLARIS_KEY" https://api.polaris.computer/api/compute/instances

  # SSH in
  ssh root@<ip>

  # When done -- TERMINATE or it keeps billing
  curl -s -X DELETE -H "Authorization: Bearer $POLARIS_KEY" \
    https://api.polaris.computer/api/compute/instances/<instance-id>

  Pricing (per hour, spot):
  - V100 16GB: $0.15
  - A100 80GB: $1.65
  - H100 80GB: $2.89
  - H200 141GB: $4.35

  Billed per second. When you need more credits just let me know.