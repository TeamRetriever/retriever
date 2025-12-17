import {Request, Response, NextFunction} from 'express'; 
import jwt from 'jsonwebtoken'
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getStringParam, JWTPayload, isJWTPayload } from '../types/index'


const JWT_SECRET = process.env.JWT_SECRET!; // We validate this exists in server.ts
const COOKIE_NAME = 'retriever_auth';
const COOKIE_MAX_AGE_DAYS = parseInt(process.env.COOKIE_MAX_AGE_DAYS || '7');


// this will load the HTML 

const loginHTML = readFileSync(
    join(__dirname, '../views/login.html'), 
    'utf-8'
); 

const errorHTML = readFileSync(
    join(__dirname, '../views/error.html'), 
    'utf-8'
); 





function verifyToken(token: string, secret: string): JWTPayload {
    const decoded = jwt.verify(token, secret, {
        algorithms: ['HS256'], 
        audience: 'mcp', 
        issuer: 'retriever'
    }); 

    if (!isJWTPayload(decoded)) {
        throw new Error ('Invalid token payload structure'); 
    }
    return decoded; 
}
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
    const token = req.cookies[COOKIE_NAME];
    
    if (!token) {
      const redirectPath = req.originalUrl;
      res.redirect(`/auth?redirect=${encodeURIComponent(redirectPath)}`);
      return;
    }
    
    try {
      const payload = verifyToken(token, JWT_SECRET);
      req.jwtPayload = payload;
      next();
    } catch (err) {
      res.clearCookie(COOKIE_NAME);
      const redirectPath = req.originalUrl;
      res.redirect(`/auth?redirect=${encodeURIComponent(redirectPath)}`);
    }
} 


export function showLoginForm(req: Request, res: Response): void {
    const redirect = getStringParam(req.query.redirect) || '/jaeger'; 
    const html = loginHTML.replace('{{REDIRECT_URL}}', redirect); 
    res.send(html)
}


export function handleLogin(req: Request, res: Response): void {
    const token = getStringParam(req.body.token); 
    const redirect = getStringParam(req.body.redirect) || '/jaeger'; 

    if (!token) {
        const html = errorHTML
        .replace('{{ERROR_MESSAGE}}', 'No token provided')
        .replace('{{ERROR_DETAILS}}', 'Please place your Retriever access token'); 
        res.status(400).send(html); 
        return; 
    }

    try {
        const payload = verifyToken(token, JWT_SECRET); 
        console.log('✓✓✓ Token validated for:', payload.sub)

        // set the http only cookie 
        res.cookie(COOKIE_NAME, token, {
            httpOnly: true, 
            secure: process.env.NODE_ENV === 'production', 
            sameSite: 'lax', 
            maxAge: COOKIE_MAX_AGE_DAYS * 24 * 60 * 60 * 24
        }); 

        res.redirect(redirect); 
    } catch (err) {
        let errorMessage = 'Invalid token'; 
        let errorDetails = 'The token could not be verified'; 

        if (err instanceof Error) {
            if (err.message.includes('expired')) {
                errorMessage = 'Token expired'; 
                errorDetails = 'Your token has expired. Please generate a new one using: retriever token generate'
            } else if (err.message.includes('signature')) {
                errorMessage = 'Invalid signature'; 
                errorDetails = 'The token signature is invalid.'
            } else {
                errorDetails = err.message; 
            }
        } 
        console.error('Token validation failed, err'); 

        const html = errorHTML
        .replace('{{ERROR_MESSAGE}}', errorMessage)
        .replace('{{ERROR_DETAILS}}', errorDetails); 
    }

 
}