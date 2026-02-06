import { ethers } from 'ethers'
import TokenABI from '@/mod/contracts/abi/token/Token.sol/Token.json'
import MarketABI from '@/mod/contracts/abi/market/Market.sol/Market.json'
import modConfig from '@/app/mod.json'

function getEthereumProvider(): ethers.BrowserProvider {
  if (typeof window === 'undefined') {
    throw new Error('Window is undefined - running in server context')
  }

  if (!window.ethereum) {
    throw new Error('No Ethereum provider found. Please install MetaMask or another wallet.')
  }

  // Safari-specific debugging
  const userAgent = navigator.userAgent.toLowerCase()
  const isSafari = userAgent.includes('safari') && !userAgent.includes('chrome')
  if (isSafari) {
    console.log('[Safari] Ethereum provider detected:', !!window.ethereum)
  }

  return new ethers.BrowserProvider(window.ethereum)
}

export class Market {
  private config: any

  constructor(config: any) {
    this.config = config
  }

  public getTokenAddress(tokenType: string): string {
    const network = 'testnet'
    const chainConfig = modConfig.chain?.[network] as any
    if (!chainConfig) {
      throw new Error('Chain config not found')
    }
    
    const tokenAddress = (chainConfig.contracts as Record<string, any>)[tokenType]?.address
    if (!tokenAddress) {
      throw new Error(`Token ${tokenType} not found in config`)
    }
    
    return tokenAddress
  }

  public async getTokenDecimals(tokenAddress: string): Promise<number> {
    try {
      const provider = getEthereumProvider()
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
      const provider = getEthereumProvider()
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

  async checkMarketBalance(userAddress: string): Promise<number> {
    try {
      if (typeof window === 'undefined' || !window.ethereum) {
        console.warn('No Ethereum provider available')
        return 0
      }

      const provider = getEthereumProvider()
      const marketAddress = this.config.contracts.Market.address

      if (!marketAddress) {
        console.error('Market address not found in config')
        return 0
      }

      const marketContract = new ethers.Contract(marketAddress, MarketABI.abi, provider)

      // Market contract uses 18 decimals (like ETH)
      const balance = await marketContract.balanceOf(userAddress)
      const balanceFormatted = parseFloat(ethers.formatUnits(balance, 18))

      console.log(`Market balance for ${userAddress}:`, balanceFormatted)
      return balanceFormatted
    } catch (error) {
      console.error('Error checking market balance:', error)
      // Return 0 instead of throwing to prevent UI breaks
      return 0
    }
  }

  async checkMarketAllowance(userAddress: string, tokenType: string = 'USDC'): Promise<number> {
    try {
      const provider = getEthereumProvider()
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
      const provider = getEthereumProvider()
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
      const provider = getEthereumProvider()
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
      const provider = getEthereumProvider()
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

  async transferMarketCredit(toAddress: string, amount: number): Promise<any> {
    try {
      const provider = getEthereumProvider()
      const signer = await provider.getSigner()
      const marketAddress = this.config.contracts.Market.address

      const marketContract = new ethers.Contract(marketAddress, MarketABI.abi, signer)
      // Market credit uses 18 decimals (like ETH)
      const amountInWei = ethers.parseUnits(amount.toString(), 18)

      const tx = await marketContract.transfer(toAddress, amountInWei)
      const receipt = await tx.wait()

      return receipt
    } catch (error) {
      console.error('Error transferring market credit:', error)
      throw error
    }
  }
}
