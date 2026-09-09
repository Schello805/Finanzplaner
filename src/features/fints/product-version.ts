const FINTS_PRODUCT_VERSION_MAX_LENGTH=5;

/**
 * FinTS limits the product version in HKVVB to five alphanumeric characters.
 * Keep the full APP_VERSION for the UI and derive a compact protocol value here.
 */
export function finTsProductVersion(value=process.env.APP_VERSION??process.env.npm_package_version??"0.5"){
 const cleaned=value.trim().replace(/^v(?=\d)/i,"").replace(/[^a-z0-9.]/gi,"");
 if(!cleaned)return"0.5";
 if(cleaned.length<=FINTS_PRODUCT_VERSION_MAX_LENGTH)return cleaned;
 const compact=cleaned.replace(/\./g,"");
 return(compact||"0.5").slice(0,FINTS_PRODUCT_VERSION_MAX_LENGTH);
}
