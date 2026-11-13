import assert from "node:assert/strict";
import { test } from "node:test";
import { joinPhoneNumber, phoneCountries, splitPhoneNumber } from "./phone-number";

test("Vietnam is the default, and a country selection alone is not a phone number", () => {
  assert.equal(phoneCountries[0].code, "84");
  assert.equal(new Set(phoneCountries.map(({ code }) => code)).size, phoneCountries.length);
  for (const { code } of phoneCountries) {
    assert.deepEqual(splitPhoneNumber(joinPhoneNumber(code, "0123456")), { code, number: "0123456" });
  }
  assert.deepEqual(splitPhoneNumber(""), { code: "84", number: "" });
  assert.deepEqual(splitPhoneNumber("0346612345"), { code: "84", number: "0346612345" });
  assert.equal(joinPhoneNumber("84", "0346612345"), "+84 0346612345");
  for (const code of ["84", "1", "61"]) assert.equal(joinPhoneNumber(code, " "), "");
  for (const value of ["+84", "(+84)", "+1 "]) assert.equal(joinPhoneNumber("84", value), "");
  assert.equal(splitPhoneNumber(joinPhoneNumber("84", "0346 ")).number, "0346 ");
});

test("saved and pasted international phones split without losing national digits or formatting", () => {
  for (const [value, code, number] of [
    ["(+84)0346612345", "84", "0346612345"],
    ["+84 034.661.2345", "84", "034.661.2345"],
    ["+1 (234) 567-8900", "1", "(234) 567-8900"],
    ["+61412345678", "61", "412345678"],
    ["+962771234567", "962", "771234567"],
    ["+852 1234 5678", "852", "1234 5678"],
  ]) assert.deepEqual(splitPhoneNumber(value), { code, number });
  assert.deepEqual(splitPhoneNumber("+99912345"), { code: "", number: "+99912345" });
  assert.equal(joinPhoneNumber("", "+99912345"), "+99912345");
  assert.equal(joinPhoneNumber("84", "+99912345"), "+99912345");
});
