import { Request, Response, NextFunction } from 'express'; 
import jwt from 'jsonwebtoken'; 

import {isJWTPayload} from './types'; 

if (!process.env.JWT_SECRET) {
    console.error("Error: JWT_SECRET is not set"); 
    console.error("Set JWT_SECRET"); 
    process.exit(1);
}


const JWT_SECRET = process.env.JWT_SECRET; 



export function validateJWT(req: Request, res: Response, next: NextFunction): void {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Missing Authorization header. Use: Authorization: Bearer <token>'
      });
      return;
    }
    
    const token = authHeader.substring(7);
    
    try {
      const decoded = jwt.verify(token, JWT_SECRET, {
        algorithms: ['HS256'],
        audience: 'mcp',
        issuer: 'retriever'
      }) 

         
    if (!isJWTPayload(decoded)) {
        res.status(401).json({
          error: 'Invalid token',
          message: 'Token payload structure is invalid'
        });
        return;
      }
      
      req.jwtPayload = decoded;
      next();
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        res.status(401).json({
          error: 'Token expired',
          message: 'Your token has expired'
        });
        return;
      }
      
      if (err instanceof jwt.JsonWebTokenError) {
        res.status(401).json({
          error: 'Invalid token',
          message: err.message
        });
        return;
      }
      
      console.error('JWT validation error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

