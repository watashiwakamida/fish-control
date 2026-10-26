export const cutoff=Date.parse('2026-11-01T00:00:00+08:00');
export function budgetStatus(ledger,now=Date.now()){
 if(!ledger||!Number.isFinite(ledger.estimatedCny)||!Number.isFinite(ledger.limitCny))return {blocked:true,reason:'费用账本未就绪'};
 if(now>=cutoff)return {blocked:true,reason:'已到11月1日费用复核日期'};
 const held=Object.values(ledger.unsettled||{}).reduce((a,b)=>a+(Number(b)||0),0);
 return ledger.estimatedCny+held+5>ledger.limitCny?{blocked:true,reason:'保守估算与请求预留已触发费用保护'}:{blocked:false,reason:''};
}
