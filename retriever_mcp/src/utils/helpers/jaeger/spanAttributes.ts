import type { OTLPAttribute, OTLPSpan } from "../../../types/jaeger";

// Extracts the actual value from an OTLP attribute's variant type
// Since Jaeger key values will always only have 1 property populated, this function returns the one true value
// Returns undefined if no value is present
function getAttributeValue(attr: OTLPAttribute): string | number | boolean | undefined {
    if (!attr.value) return undefined;
    
    return attr.value.stringValue ?? 
           attr.value.intValue ?? 
           attr.value.boolValue ?? 
           attr.value.doubleValue;
}

// Searches an array of attributes for one with a specific key name
// Returns the matching attribute or undefined if not found
function findAttribute(attributes: OTLPAttribute[] | undefined, key: string): OTLPAttribute | undefined {
    return attributes?.find(attr => attr.key === key);
}


// Extracts relevant tags from span attributes
// Filters to keep only error.*, http.*, db.*, rpc.*, messaging.* tags
function extractRelevantTags(span: OTLPSpan): Record<string, string | number | boolean> {
    const tags: Record<string, string | number | boolean> = {};
    
    if (!span.attributes) {
        return tags;
    }
    
    for (const attr of span.attributes) {
        // Only keep tags that are useful for debugging and analysis
        const isRelevant = attr.key.startsWith('error.') || 
                          attr.key.startsWith('http.') ||
                          attr.key.startsWith('db.') ||
                          attr.key.startsWith('rpc.') ||
                          attr.key.startsWith('messaging.');
        
        if (isRelevant) {
            const value = getAttributeValue(attr);
            if (value !== undefined) {
                tags[attr.key] = value;
            }
        }
    }
    
    return tags;
}


export  {getAttributeValue, findAttribute, extractRelevantTags}