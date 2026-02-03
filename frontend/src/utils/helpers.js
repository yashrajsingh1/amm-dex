import { ethers } from 'ethers';

/**
 * Format a BigInt value to a readable string with specified decimals
 */
export function formatUnits(value, decimals = 18) {
  if (!value) return '0';
  return ethers.formatUnits(value.toString(), decimals);
}

/**
 * Parse a string value to BigInt with specified decimals
 */
export function parseUnits(value, decimals = 18) {
  if (!value || value === '') return 0n;
  try {
    return ethers.parseUnits(value.toString(), decimals);
  } catch {
    return 0n;
  }
}

/**
 * Format a number to a fixed number of decimal places
 */
export function formatNumber(value, decimals = 4) {
  const num = parseFloat(value);
  if (isNaN(num)) return '0';
  if (num === 0) return '0';
  if (num < 0.0001) return '<0.0001';
  return num.toFixed(decimals);
}

/**
 * Format an address for display (0x1234...5678)
 */
export function formatAddress(address) {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Calculate price impact for a swap
 */
export function calculatePriceImpact(amountIn, reserveIn, reserveOut) {
  if (!reserveIn || !reserveOut || reserveIn === 0n) return 0;
  
  const amountInBig = BigInt(amountIn);
  const reserveInBig = BigInt(reserveIn);
  const reserveOutBig = BigInt(reserveOut);
  
  // Ideal rate (spot price)
  const spotPrice = (reserveOutBig * 10000n) / reserveInBig;
  
  // Actual output with fee (997/1000 = 0.3% fee)
  const amountInWithFee = amountInBig * 997n;
  const numerator = reserveOutBig * amountInWithFee;
  const denominator = reserveInBig * 1000n + amountInWithFee;
  const actualOutput = numerator / denominator;
  
  // Execution price
  const executionPrice = amountInBig > 0n 
    ? (actualOutput * 10000n) / amountInBig 
    : 0n;
  
  // Price impact percentage
  if (spotPrice === 0n) return 0;
  const impact = Number(((spotPrice - executionPrice) * 10000n) / spotPrice) / 100;
  return Math.max(0, impact);
}

/**
 * Calculate output amount for swap
 */
export function getAmountOut(amountIn, reserveIn, reserveOut) {
  if (!amountIn || !reserveIn || !reserveOut) return 0n;
  if (reserveIn === 0n || reserveOut === 0n) return 0n;
  
  const amountInBig = BigInt(amountIn);
  const reserveInBig = BigInt(reserveIn);
  const reserveOutBig = BigInt(reserveOut);
  
  const amountInWithFee = amountInBig * 997n;
  const numerator = reserveOutBig * amountInWithFee;
  const denominator = reserveInBig * 1000n + amountInWithFee;
  
  return numerator / denominator;
}

/**
 * Calculate required input for desired output
 */
export function getAmountIn(amountOut, reserveIn, reserveOut) {
  if (!amountOut || !reserveIn || !reserveOut) return 0n;
  if (reserveIn === 0n || reserveOut === 0n) return 0n;
  
  const amountOutBig = BigInt(amountOut);
  const reserveInBig = BigInt(reserveIn);
  const reserveOutBig = BigInt(reserveOut);
  
  if (amountOutBig >= reserveOutBig) return 0n;
  
  const numerator = reserveInBig * amountOutBig * 1000n;
  const denominator = (reserveOutBig - amountOutBig) * 997n;
  
  return numerator / denominator + 1n;
}

/**
 * Calculate pool share percentage
 */
export function calculatePoolShare(userLiquidity, totalLiquidity) {
  if (!totalLiquidity || totalLiquidity === 0n) return 0;
  return (Number(userLiquidity) / Number(totalLiquidity)) * 100;
}

/**
 * Format time ago
 */
export function timeAgo(timestamp) {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
