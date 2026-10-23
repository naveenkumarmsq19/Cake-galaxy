import test from "node:test";
import assert from "node:assert/strict";
import { sendOtp, sendSmsOtp, verifyOtp } from "../src/providers.js";

function withEnvironment(overrides, fn) {
  const prior = Object.fromEntries(Object.keys(overrides).map(key=>[key,process.env[key]]));
  const fetchOriginal = globalThis.fetch;
  Object.assign(process.env,overrides);
  return Promise.resolve().then(fn).finally(()=>{
    globalThis.fetch = fetchOriginal;
    for (const [key,value] of Object.entries(prior)) {
      if (value===undefined) delete process.env[key]; else process.env[key]=value;
    }
  });
}

test("real SMS OTP sends only via approved template and never discloses the generated code", async () => {
  await withEnvironment({
    NODE_ENV:"production",DEV_OTP_ENABLED:"false",MSG91_AUTH_KEY:"secret-test-key",
    MSG91_SMS_OTP_TEMPLATE_ID:"approved-template-123",
    MSG91_WHATSAPP_NUMBER:"919999999999",MSG91_WHATSAPP_OTP_TEMPLATE_NAME:"inactive-whatsapp"
  }, async () => {
    let request;
    globalThis.fetch=async(url,options)=>{
      request={url:String(url),options};
      return new Response(JSON.stringify({type:"success",message:"queued"}),{status:200});
    };
    const result=await sendOtp("9876543210");
    assert.deepEqual(result,{code:null,channel:"sms"});
    const parsed=new URL(request.url);
    assert.equal(parsed.origin,"https://control.msg91.com");
    assert.equal(parsed.pathname,"/api/v5/otp");
    assert.equal(parsed.searchParams.get("mobile"),"919876543210");
    assert.equal(parsed.searchParams.get("template_id"),"approved-template-123");
    assert.equal(parsed.searchParams.get("otp_length"),"6");
    assert.equal(parsed.searchParams.get("otp_expiry"),"5");
    assert.equal(request.options.method,"POST");
    assert.equal(request.options.headers.authkey,"secret-test-key");
    assert.deepEqual(JSON.parse(request.options.body),{});
    assert.ok(!JSON.stringify(result).includes("123456"));
  });
});

test("SMS OTP is never claimed as sent when MSG91 rejects the sender/template", async()=>{
  await withEnvironment({
    NODE_ENV:"production",DEV_OTP_ENABLED:"false",MSG91_AUTH_KEY:"test-key",
    MSG91_SMS_OTP_TEMPLATE_ID:"pending-dlt-template"
  },async()=>{
    globalThis.fetch=async()=>new Response(JSON.stringify({type:"error",message:"template not approved"}),{status:200});
    await assert.rejects(sendSmsOtp("9876543210"),error=>error.status===502 && /SMS OTP could not be sent/.test(error.message));
    globalThis.fetch=async()=>new Response(JSON.stringify({type:"error"}),{status:401});
    await assert.rejects(sendOtp("9876543210"),error=>error.status===502);
  });
});

test("Verify OTP delegates to MSG91 for externally generated SMS codes",async()=>{
  await withEnvironment({MSG91_AUTH_KEY:"test-key"},async()=>{
    let url;
    globalThis.fetch=async(u,opts)=>{url=String(u);assert.equal(opts.headers.authkey,"test-key");return new Response(JSON.stringify({type:"success",message:"OTP verified success"}),{status:200});};
    assert.equal(await verifyOtp("9876543210","123456"),true);
    const parsed=new URL(url);
    assert.equal(parsed.pathname,"/api/v5/otp/verify");
    assert.equal(parsed.searchParams.get("mobile"),"919876543210");
    assert.equal(parsed.searchParams.get("otp"),"123456");
    globalThis.fetch=async()=>new Response(JSON.stringify({type:"error",message:"OTP expired"}),{status:200});
    await assert.rejects(verifyOtp("9876543210","123456"),error=>error.status===400);
  });
});
