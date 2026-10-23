// Safe public UI interactions on LIVE Cake Galaxy. No user OTP, payment, order or server writes.
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
const BASE = process.env.CAKE_GALAXY_URL || "https://cakegalaxy.in";
const checks = [];
const log = (name,state,detail="") => {
  const r={name,state,detail};checks.push(r); console.log("UI_CHECK "+JSON.stringify(r));
};
await mkdir("qa-artifacts", {recursive:true});
const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1});
try {
  const res=await context.request.get(BASE+"/api/catalog",{timeout:20000});
  if(!res.ok())throw new Error("Cannot test product interactions: catalog HTTP "+res.status());
  const {products=[]}=await res.json();
  const product=products.find(p=>p.id&&p.weights?.length&&p.images?.length>1);
  if(!product)throw new Error("No public product with gallery found");
  const page=await context.newPage();
  async function check(name,fn) {
    try {const detail=await fn();log(name,"PASS",String(detail||"")); }
    catch(e) {
      const message=String(e?.message||e).slice(0,500);
      log(name,"FAIL",message);
      await page.screenshot({path:"qa-artifacts/interact-"+name.replace(/[^a-z0-9]+/gi,"-")+".png",fullPage:true}).catch(()=>{});
    }
  }
  await check("Shop search for cake",async()=>{
    await page.goto(BASE+"/shop/",{waitUntil:"domcontentloaded"});
    const query=page.locator('form[role="search"] input[name="q"]').first();
    await query.fill("velvet");
    await query.press("Enter");
    await page.waitForURL(/q=velvet/i,{timeout:9000});
    await page.locator(".product-card").first().waitFor({timeout:10000});
    return "result cards="+await page.locator(".product-card").count();
  });
  await check("Category filter",async()=>{
    await page.goto(BASE+"/shop/?category="+encodeURIComponent("Chocolate Cakes"),{waitUntil:"domcontentloaded"});
    await page.locator(".product-card").first().waitFor({timeout:10000});
    return "Chocolate Cakes, cards="+await page.locator(".product-card").count();
  });
  await check("Product photo gallery and full view",async()=>{
    await page.goto(BASE+"/product/?id="+encodeURIComponent(product.id),{waitUntil:"domcontentloaded"});
    await page.getByRole("heading",{name:product.name,exact:true}).waitFor({timeout:10000});
    await page.getByRole("button",{name:/View full photo/i}).click();
    const dialog=page.locator("dialog.product-gallery-full-dialog");
    await dialog.waitFor({state:"visible",timeout:5000});
    const image=dialog.locator("img");
    await image.waitFor({state:"visible"});
    const shape=await image.evaluate(el=>({width:el.naturalWidth,height:el.naturalHeight}));
    if(!shape.width||!shape.height)throw new Error("Modal image not loaded");
    await dialog.getByRole("button",{name:/Close full photo/i}).click();
    await dialog.waitFor({state:"hidden"});
    return product.name+" original="+shape.width+"x"+shape.height;
  });
  await check("Gallery thumbnails",async()=>{
    await page.goto(BASE+"/product/?id="+encodeURIComponent(product.id),{waitUntil:"domcontentloaded"});
    const thumbs=page.locator(".product-gallery-thumbs button");
    await thumbs.nth(1).waitFor({timeout:10000});
    await thumbs.nth(1).click();
    await page.waitForTimeout(250);
    const active=await thumbs.nth(1).getAttribute("class");
    if(!active?.includes("active"))throw new Error("Second thumbnail not active");
    return "thumbnail count="+await thumbs.count();
  });
  await check("Cart quantity, persistence and removal",async()=>{
    await page.goto(BASE+"/",{waitUntil:"domcontentloaded"});
    await page.evaluate(({id,size})=>{localStorage.setItem("cakegalaxy.basket.v2",JSON.stringify([{
      id:"qa-client-only-cart",productId:id,size:Number(size),quantity:1,eggless:false,flavour:"",
      message:"",addons:[]
    }]));},{id:product.id,size:product.weights[0]});
    await page.goto(BASE+"/cart/",{waitUntil:"domcontentloaded"});
    await page.getByRole("heading",{name:/Your celebration bag/i}).waitFor({timeout:10000});
    await page.getByRole("button",{name:"Increase quantity"}).click();
    const after=await page.evaluate(()=>JSON.parse(localStorage.getItem("cakegalaxy.basket.v2"))[0]?.quantity);
    if(after!==2)throw new Error("Quantity was "+after+" instead of 2");
    await page.reload();
    await page.getByRole("button",{name:"Remove "+product.name}).click();
    const remaining=await page.evaluate(()=>JSON.parse(localStorage.getItem("cakegalaxy.basket.v2")||"[]").length);
    if(remaining!==0)throw new Error("Remove failed, remaining "+remaining);
    return "Client-side basket updated, survived refresh, removed";
  });
  await check("My Orders anonymous verification guard",async()=>{
    await page.goto(BASE+"/orders/",{waitUntil:"domcontentloaded"});
    await page.getByRole("heading",{name:/My orders/i}).waitFor({timeout:10000});
    const input=page.locator('input[type="tel"]').first();
    if(await input.count()===0)throw new Error("No phone verification input");
    return "Login required and phone input visible";
  });
  await check("Admin sign-in screen",async()=>{
    await page.goto(BASE+"/admin/",{waitUntil:"domcontentloaded"});
    await page.locator('input[type="email"]').waitFor({timeout:10000});
    if(await page.locator('input[type="password"]').count()===0) throw new Error("No admin password input");
    return "Admin credentials form rendered; no login attempted";
  });
  for(const width of [320,375,390,768,1440]){
    await check("Product responsive "+width+"px",async()=>{
      await page.setViewportSize({width,height:900});
      await page.goto(BASE+"/product/?id="+encodeURIComponent(product.id),{waitUntil:"domcontentloaded"});
      await page.locator(".product-gallery-stage").waitFor({timeout:10000});
      const d=await page.evaluate(()=>({
        scroll:document.documentElement.scrollWidth,
        viewport:window.innerWidth,
        stage:document.querySelector(".product-gallery-stage")?.getBoundingClientRect().width,
        imageNaturalWidth:document.querySelector(".product-gallery-slide img")?.naturalWidth
      }));
      if(d.scroll>d.viewport+3)throw new Error("Horizontal overflow "+JSON.stringify(d));
      if(!d.stage||d.stage>d.viewport)throw new Error("Gallery out of viewport "+JSON.stringify(d));
      return JSON.stringify(d);
    });
  }
  await page.evaluate(()=>localStorage.removeItem("cakegalaxy.basket.v2")).catch(()=>{});
  await page.close();
} catch(e) {
  log("Live interaction suite prerequisite","BLOCKED",String(e?.message||e).slice(0,450));
} finally {
  await context.close(); await browser.close();
}
const summary={passed:checks.filter(c=>c.state==="PASS").length,failed:checks.filter(c=>c.state==="FAIL").length,blocked:checks.filter(c=>c.state==="BLOCKED").length,total:checks.length};
console.log("UI_SUMMARY "+JSON.stringify(summary));
await writeFile("qa-artifacts/interaction-report.json",JSON.stringify({url:BASE,checks,summary},null,2));
if(summary.failed>0)process.exitCode=1;
