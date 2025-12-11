import {Request} from 'express'; 


export interface JWTPayload {
    iss: string; 
    sub: string; 
    aud: string; 
    iat: number; 
    exp: number;
}

export function isJWTPayload(payload: unknown): payload is JWTPayload {
    return (
      typeof payload === 'object' &&
      payload !== null &&
      'iss' in payload &&
      'sub' in payload &&
      'aud' in payload &&
      'iat' in payload &&
      'exp' in payload
    );
  }

declare global { // syntax to extend Express namespace to include our custom auth property
    namespace Express {
        interface Request {
            jwtPayload?: JWTPayload; 
        }
    }
}

