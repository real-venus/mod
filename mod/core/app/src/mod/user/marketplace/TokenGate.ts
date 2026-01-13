export class TokenGate {
  private discountedAddresses: Set<string> = new Set([
    // Add whitelisted addresses here
  ])
  
  private discountRate: number = 0.9 // 10% discount

  hasDiscount(address: string): boolean {
    return this.discountedAddresses.has(address.toLowerCase())
  }

  calculatePrice(basePrice: number, address: string): number {
    if (this.hasDiscount(address)) {
      return basePrice * this.discountRate
    }
    return basePrice
  }

  addDiscountedAddress(address: string): void {
    this.discountedAddresses.add(address.toLowerCase())
  }

  removeDiscountedAddress(address: string): void {
    this.discountedAddresses.delete(address.toLowerCase())
  }
}