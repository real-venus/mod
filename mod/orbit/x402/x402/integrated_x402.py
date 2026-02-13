#!/usr/bin/env python3
"""
INTEGRATED X402 - FULLY FUNCTIONAL PAYMENT GATEWAY
Combines EnhancedX402 with X402Middleware for complete payment processing
"""

import json
import time
import logging
from typing import Dict, Any, Optional, List
from http.server import HTTPServer, BaseHTTPRequestHandler
from enhanced_x402 import EnhancedX402, DynamicPricing, FraudDetector, MultiChainBridge
from x402 import X402Middleware, PaymentVerification
from whitelist_manager import WhitelistManager
import os

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("x402.integrated")


class IntegratedX402:
    """Unified X402 payment gateway combining all features"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        
        # Initialize enhanced payment processor
        self.enhanced = EnhancedX402(config)
        
        # Initialize whitelist manager
        self.whitelist = WhitelistManager(
            mode=config.get("whitelist_mode", "offchain"),
            contract_address=config.get("whitelist_contract"),
            rpc_url=config.get("whitelist_rpc", "https://mainnet.base.org"),
            offchain_file=config.get("whitelist_file", "whitelist.json"),
            offchain_url=config.get("whitelist_url")
        )
        
        # Initialize middleware with custom verifier
        self.middleware = X402Middleware(
            app=self._handle_request,
            receiver=config.get("receiver", "YourWalletAddress"),
            facilitator_url=config.get("facilitator_url", "https://x402.org/facilitator"),
            protected_paths=config.get("protected_paths", ["/api/premium", "/ipfs/premium"]),
            network=config.get("network", "solana"),
            price=config.get("price", "1"),
            currency=config.get("currency", "USDC"),
            custom_verifier=self._verify_payment,
            on_payment_success=self._on_payment_success,
            on_payment_failure=self._on_payment_failure
        )
        
        logger.info("🚀 Integrated X402 initialized - FULL POWER MODE")
    
    def _verify_payment(self, payment_header: str) -> PaymentVerification:
        """Custom payment verifier with whitelist and fraud detection"""
        try:
            payment_data = json.loads(payment_header)
            wallet = payment_data.get("wallet") or payment_data.get("sender") or payment_data.get("from")
            
            # Check whitelist first - free access
            if wallet and self.whitelist.is_whitelisted(wallet):
                logger.info(f"✅ Whitelisted wallet: {wallet}")
                return PaymentVerification(
                    valid=True,
                    transaction_id="WHITELISTED",
                    amount="0",
                    currency=self.config.get("currency", "USDC"),
                    timestamp=int(time.time())
                )
            
            # Fraud detection
            fraud_check = self.enhanced.fraud_detector.analyze(wallet, payment_data)
            if not fraud_check["allow"]:
                logger.warning(f"🚫 Fraud detected: {wallet} - Score: {fraud_check['risk_score']}")
                return PaymentVerification(
                    valid=False,
                    error=f"Fraud detected: {', '.join(fraud_check['flags'])}"
                )
            
            # Process payment with dynamic pricing
            result = self.enhanced.process_payment(payment_data)
            
            if result["success"]:
                return PaymentVerification(
                    valid=True,
                    transaction_id=payment_data.get("transaction_id", "PROCESSED"),
                    amount=str(result["final_price"]),
                    currency=self.config.get("currency", "USDC"),
                    timestamp=result["timestamp"]
                )
            else:
                return PaymentVerification(
                    valid=False,
                    error=result.get("error", "Payment processing failed")
                )
                
        except json.JSONDecodeError:
            return PaymentVerification(valid=False, error="Invalid payment format")
        except Exception as e:
            logger.error(f"Payment verification error: {e}")
            return PaymentVerification(valid=False, error=str(e))
    
    def _on_payment_success(self, handler, verification: PaymentVerification):
        """Callback for successful payment"""
        logger.info(f"💰 Payment success: {verification.transaction_id} - {verification.amount} {verification.currency}")
    
    def _on_payment_failure(self, handler, verification: PaymentVerification):
        """Callback for failed payment"""
        logger.warning(f"❌ Payment failed: {verification.error}")
    
    def _handle_request(self, handler):
        """Handle authenticated requests"""
        pass  # Middleware will call this after successful payment
    
    def get_analytics(self) -> Dict[str, Any]:
        """Get combined analytics"""
        return {
            "enhanced": self.enhanced.get_analytics(),
            "middleware": self.middleware.get_metrics(),
            "whitelist_count": len(self.whitelist.get_all_whitelisted())
        }


class IntegratedX402Handler(BaseHTTPRequestHandler):
    """HTTP handler for integrated X402 server"""
    
    def __init__(self, *args, integrated: IntegratedX402, **kwargs):
        self.integrated = integrated
        super().__init__(*args, **kwargs)
    
    def do_GET(self):
        # Health check
        if self.path == "/health":
            self._send_json({"status": "healthy", "timestamp": int(time.time())})
            return
        
        # Analytics
        if self.path == "/analytics":
            self._send_json(self.integrated.get_analytics())
            return
        
        # Whitelist endpoints
        if self.path == "/whitelist":
            self._send_json({"addresses": self.integrated.whitelist.get_all_whitelisted()})
            return
        
        if self.path.startswith("/whitelist/check/"):
            address = self.path.split("/")[-1]
            is_wl = self.integrated.whitelist.is_whitelisted(address)
            self._send_json({"address": address, "whitelisted": is_wl})
            return
        
        # Protected content - middleware handles payment
        self.integrated.middleware.handle(self)
        
        # Serve content after payment verification
        if self.path.startswith("/api/premium"):
            self._send_json({"data": "Premium API content", "tier": "premium"})
        elif self.path.startswith("/ipfs/premium"):
            self._send_json({"data": "Premium IPFS content", "cid": "Qm..."})
        else:
            self._send_json({"data": "Public content", "tier": "free"})
    
    def do_POST(self):
        # Whitelist management
        if self.path == "/whitelist/add":
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)
            try:
                data = json.loads(body)
                address = data.get("address")
                if address:
                    self.integrated.whitelist.add_to_whitelist(address)
                    self._send_json({"success": True, "address": address})
                else:
                    self._send_error(400, "Address required")
            except json.JSONDecodeError:
                self._send_error(400, "Invalid JSON")
            return
        
        self._send_error(404, "Not found")
    
    def do_OPTIONS(self):
        self.send_response(204)
        self._send_cors_headers()
        self.end_headers()
    
    def _send_json(self, data, status=200):
        body = json.dumps(data, indent=2).encode()
        self.send_response(status)
        self._send_cors_headers()
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)
    
    def _send_error(self, status, message):
        self._send_json({"error": message}, status)
    
    def _send_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "X-PAYMENT, Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    
    def log_message(self, format, *args):
        logger.info(f"{self.client_address[0]} - {format % args}")


def main():
    """Run integrated X402 server"""
    config = {
        "receiver": os.getenv("RECEIVER_ADDRESS", "YourSolanaAddressHere"),
        "network": os.getenv("NETWORK", "solana"),
        "price": os.getenv("PRICE", "1"),
        "currency": os.getenv("CURRENCY", "USDC"),
        "facilitator_url": os.getenv("FACILITATOR_URL", "https://x402.org/facilitator"),
        "whitelist_mode": os.getenv("WHITELIST_MODE", "offchain"),
        "whitelist_contract": os.getenv("WHITELIST_CONTRACT"),
        "whitelist_rpc": os.getenv("WHITELIST_RPC", "https://mainnet.base.org"),
        "whitelist_file": os.getenv("WHITELIST_FILE", "whitelist.json"),
        "whitelist_url": os.getenv("WHITELIST_URL"),
        "protected_paths": ["/api/premium", "/ipfs/premium", "/protected"]
    }
    
    integrated = IntegratedX402(config)
    
    def handler_factory(*args, **kwargs):
        return IntegratedX402Handler(*args, integrated=integrated, **kwargs)
    
    port = int(os.getenv("PORT", "50149"))
    server = HTTPServer(("0.0.0.0", port), handler_factory)
    
    logger.info(f"🚀 Integrated X402 Server running on http://0.0.0.0:{port}")
    logger.info(f"💎 Receiver: {config['receiver']}")
    logger.info(f"🌐 Network: {config['network']}, Price: {config['price']} {config['currency']}")
    logger.info(f"🔐 Whitelist mode: {config['whitelist_mode']}")
    logger.info(f"🛡️ Protected paths: {config['protected_paths']}")
    
    server.serve_forever()


if __name__ == "__main__":
    main()
