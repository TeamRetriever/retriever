import type { OTLPSpan } from "../../../types/jaeger";

// Filter for error spans only
function isErrorSpan(span: OTLPSpan): boolean {
    return span.status?.code === 2; 
 }
 
 // Filter for successful spans only
 function isSuccessfulSpan(span: OTLPSpan): boolean {
     return !isErrorSpan(span);
 }
 
   
 
   function getFilterFunction(filter: 'all' | 'errors' | 'successful'): ((span: OTLPSpan) => boolean) | undefined {
     switch (filter) {
         case 'errors':
             return isErrorSpan;
         case 'successful':
             return isSuccessfulSpan;
         case 'all':
         default:
             return undefined; // No filter - include all spans
     }
 }
 


 export {isErrorSpan, isSuccessfulSpan, getFilterFunction}