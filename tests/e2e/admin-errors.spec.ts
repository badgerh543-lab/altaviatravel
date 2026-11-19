import {test,expect} from '@playwright/test';

// The isolated Worker runtime uses a locally generated HTTPS certificate.
test.use({ignoreHTTPSErrors:true});

test('missing admin API shows a deployment message instead of a JSON parsing exception',async({page})=>{
  await page.route('**/api/admin/login/',route=>route.fulfill({status:404,body:''}));
  await page.goto('/edit/');
  await expect(page.locator('.edit-error')).toContainText('The admin API is missing from this deployment.');
  await expect(page.locator('body')).not.toContainText("Failed to execute 'json'");
});

test('empty JSON responses show a clear backend message',async({page})=>{
  await page.route('**/api/admin/login/',route=>route.fulfill({status:200,contentType:'application/json',body:''}));
  await page.goto('/edit/');
  await expect(page.locator('.edit-error')).toContainText('The admin service returned an empty or invalid response.');
});

test('HTML fallback responses never render as a password or JSON parsing error',async({page})=>{
  await page.route('**/api/admin/login/',route=>route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><title>Old host</title>'}));
  await page.goto('/edit/');
  await expect(page.locator('.edit-error')).toContainText('The admin service did not return a valid response.');
  await expect(page.locator('body')).not.toContainText('Unexpected token');
});

test('a normal rejected sign-in retains the server error message',async({page})=>{
  await page.route('**/api/admin/login/',route=>route.fulfill({status:route.request().method()==='GET'?200:401,contentType:'application/json',body:JSON.stringify(route.request().method()==='GET'?{localLogin:false,passwordMinLength:12,mfaRequired:true}:{error:'Sign-in failed. Check your credentials and code.'})}));
  await page.route('**/api/admin/session/',route=>route.fulfill({status:401,contentType:'application/json',body:JSON.stringify({error:'Sign in to continue.'})}));
  await page.goto('/edit/');
  await page.getByLabel('Username',{exact:true}).fill('fixture-user');
  await page.getByLabel('Password',{exact:true}).fill('Not-a-real-password!');
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await expect(page.locator('.edit-error')).toContainText('Sign-in failed. Check your credentials and code.');
  await expect(page.getByRole('button',{name:'Sign in',exact:true})).toBeEnabled();
});
