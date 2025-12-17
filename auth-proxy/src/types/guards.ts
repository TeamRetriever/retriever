import {Request, Response} from 'express'; 
 

export interface JWTPayload {
    sub: string; 
    iss: string; 
    aud: string; 
    exp: number; 
    iat: number; 
}


declare global {
    namespace Express {
        interface Request {
            jwtPayload?: JWTPayload; 
        }
    }
}


export function isJWTPayload (decoded: unknown): decoded is JWTPayload {
    if (typeof decoded !== 'object' || decoded === null) {
        return false; 
    }

   if (
    !('sub' in decoded) || 
    !('iss' in decoded) || 
    !('aud' in decoded) || 
    !('exp' in decoded) || 
    !('iat' in decoded) 
   ) {
    return false; 
   }

   return (
    typeof decoded.sub === 'string' &&
    typeof decoded.iss === 'string' &&
    typeof decoded.aud === 'string' &&
    typeof decoded.exp === 'number' &&
    typeof decoded.iat === 'number'
   ); 
}


export function isExpressResponse(res: unknown): res is Response {
    return (
        res !== null && 
        typeof res === 'object' && 
        'status' in res && 
        'json' in res && 
        'headerSent' in res
    ); 
}


export function getStringParam(value: unknown): string | undefined {
    if (typeof value  === 'string') {
        return value
    }

    if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'string') {
        return value[0]; 
    }

    return undefined; 
}


