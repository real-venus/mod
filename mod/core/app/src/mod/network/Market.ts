import { ethers } from 'ethers'
import TokenABI from '@/mod/contracts/abi/token/Token.sol/Token.json'
import MarketABI from '@/mod/contracts/abi/market/Market.sol/Market.json'
import modConfig from '@/app/mod.json'

export class Market {
  private config: any

  constructor(config: any) {
    this.config = config
  }

  public getTokenAddress(tokenType: string): string {
    const network = 'testnet'
    const chainConfig = modConfig.chain?.[network]
    if (!chainConfig) {
      throw new Error('Chain config not found')
    }
    
    const tokenAddress = chainConfig.contracts[tokenType]?.address
    if (!tokenAddress) {
      throw new Error(`Token ${tokenType} not found in config`)
    }
    
    return tokenAddress
  }

  public async getTokenDecimals(tokenAddress: string): Promise<number> {
    try {
      const provider = new ethers.BrowserProvider(window.ethereum)
      const tokenContract = new ethers.Contract(tokenAddress, TokenABI.abi, provider)
      const decimals = await tokenContract.decimals()
      return Number(decimals)
    } catch (error) {
      console.error('Error fetching token decimals:', error)
      return 18
    }
  }

  async getTokenABI(tokenAddress: string): Promise<any> {
    if (tokenAddress.toLowerCase() === this.config.contracts.Market.address.toLowerCase()) {
      return MarketABI.abi
    }
    return TokenABI.abi
  }

  async checkBalance(userAddress: string, tokenType: string = 'USDC'): Promise<number> {
    try {
      const provider = new ethers.BrowserProvider(window.ethereum)
      const tokenAddress = this.getTokenAddress(tokenType)
      
      const abi = await this.getTokenABI(tokenAddress)
      const tokenContract = new ethers.Contract(tokenAddress, abi, provider)
      const balance = await tokenContract.balanceOf(userAddress)
      const decimals = await this.getTokenDecimals(tokenAddress)
      console.log(`Balance for ${tokenType} at ${tokenAddress}:`, balance.toString())
      return parseFloat(ethers.formatUnits(balance, decimals))
    } catch (error) {
      console.error('Error checking balance:', error)
      throw error
    }
  }

  async checkMarketAllowance(userAddress: string, tokenType: string = 'USDC'): Promise<number> {
    try {
      const provider = new ethers.BrowserProvider(window.ethereum)
      const tokenAddress = this.getTokenAddress(tokenType)
      const marketAddress = this.config.contracts.Market.address
      
      const tokenContract = new ethers.Contract(tokenAddress, TokenABI.abi, provider)
      const allowance = await tokenContract.allowance(userAddress, marketAddress)
      const decimals = await this.getTokenDecimals(tokenAddress)

      return parseFloat(ethers.formatUnits(allowance, decimals))
    } catch (error) {
      console.error('Error checking market allowance:', error)
      throw error
    }
  }

  async increaseMarketAllowance(userAddress: string, amount: number, tokenType: 'USDC' | 'USDT' = 'USDC'): Promise<any> {
    try {
      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      const tokenAddress = this.getTokenAddress(tokenType)
      const marketAddress = this.config.contracts.Market.address
      
      const tokenContract = new ethers.Contract(tokenAddress, TokenABI.abi, signer)
      const decimals = await this.getTokenDecimals(tokenAddress)
      const amountInWei = ethers.parseUnits(amount.toString(), decimals)
      
      const tx = await tokenContract.approve(marketAddress, amountInWei)
      const receipt = await tx.wait()
      
      return receipt
    } catch (error) {
      console.error('Error increasing market allowance:', error)
      throw error
    }
  }

  async addMarketCredit(userAddress: string, amount: number, tokenType: 'USDC' | 'USDT' = 'USDC'): Promise<any> {
    try {
      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      const marketAddress = this.config.contracts.Market.address
      const tokenAddress = this.getTokenAddress(tokenType)
      
      const marketContract = new ethers.Contract(marketAddress, MarketABI.abi, signer)
      const decimals = await this.getTokenDecimals(tokenAddress)
      const amountInWei = ethers.parseUnits(amount.toString(), decimals)
      
      const tx = await marketContract.credit(tokenAddress, amountInWei)
      const receipt = await tx.wait()
      
      return receipt
    } catch (error) {
      console.error('Error adding market credit:', error)
      throw error
    }
  }

  async withdrawMarketCredit(userAddress: string, amount: number, tokenType: 'USDC' | 'USDT' = 'USDC'): Promise<any> {
    try {
      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      const marketAddress = this.config.contracts.Market.address
      const tokenAddress = this.getTokenAddress(tokenType)
      
      const marketContract = new ethers.Contract(marketAddress, MarketABI.abi, signer)
      const decimals = await this.getTokenDecimals(tokenAddress)
      const amountInWei = ethers.parseUnits(amount.toString(), decimals)
      
      const tx = await marketContract.withdraw(tokenAddress, amountInWei)
      const receipt = await tx.wait()
      
      return receipt
    } catch (error) {
      console.error('Error withdrawing market credit:', error)
      throw error
    }
  }
}
