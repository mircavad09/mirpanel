import {signature} from '../employee-security.mjs';
// A base-price or stock edit is not a different plan. Other plan changes must
// not accidentally apply an index-keyed override to a replacement plan.
export const userPriceSignature=plan=>signature({...plan,price:null,oldPrice:null,stock:null,stockEnabled:null});
