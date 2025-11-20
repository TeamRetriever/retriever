
// convert lookback time to match jaeger ms format 
function parseLookback(lookback: string): number {
    const match = lookback.match(/^(\d+)(h|m|d|s)$/);
    if (!match) {
      throw new Error(`Invalid lookback format: ${lookback}`);
    }
  
    const value = parseInt(match[1]);
    const unit = match[2];
  
    const multipliers: { [key: string]: number } = {
      's': 1000,
      'm': 60 * 1000,
      'h': 60 * 60 * 1000,
      'd': 24 * 60 * 60 * 1000,
    };
  
    return value * multipliers[unit];
  }

  function parseLookbackToSeconds(lookback: string): number {
    const match = lookback.match(/^(\d+)(s|m|h|d)$/);
    if (!match) {
      return 900; // Default 15 minutes
    }
    
    const value = parseInt(match[1]);
    const unit = match[2];
    
    const multipliers: { [key: string]: number } = {
      's': 1,
      'm': 60,
      'h': 3600,
      'd': 86400,
    };
    
    return value * multipliers[unit];
  }

  function nanoToISOString(nanoTimestamp: string) {
    const nanoseconds = BigInt(nanoTimestamp);
    const milliseconds = Number(nanoseconds / BigInt(1000000));
    const date = new Date(milliseconds);
    return date.toISOString(); 
}




  export  {parseLookback, parseLookbackToSeconds,  nanoToISOString}