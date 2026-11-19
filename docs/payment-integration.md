# Merchant preparation

Developer and Owner can open Payments inside `/edit/`. Admin cannot access those endpoints. Click, Payme and an acquiring bank have separate merchant/service/terminal fields and password inputs for keys. Changes require the current password and a fresh authenticator or recovery code. Values are encrypted in `merchant_settings`; reads expose identifiers and whether keys exist, never saved keys. Empty key inputs preserve existing keys unless Clear is selected.

Modes are Disabled and Sandbox preparation. **This does not activate a payment integration or checkout.** The server rejects live mode. Merchant ID alone cannot process payments. No card numbers, expiry dates or CVV are collected.

The chosen provider must supply the merchant agreement, UZS processing rules, correct production/sandbox credentials, and its acceptance requirements. There is no universal “any bank” merchant API; the Bank configuration records which provider/terminal will be implemented.

Provider implementation must bind a payment to the agreed immutable booking amount/currency and an opaque reference, then verify provider authentication/signature and transaction details on the server. Handle retries, duplicate callbacks, reversals/cancellations and reconciliation before changing paid status. Browser redirects and an entered merchant ID are not proof of payment. Do not switch live mode on by removing a UI limitation.

For Payme, implement its authenticated Merchant API RPC contract, including transaction checks/create/perform/cancel/state/statement methods and errors: [official Merchant API](https://developer.help.paycom.uz/protokol-merchant-api/format-zaprosa/). For Click, implement and test the provider's prepare/complete flow and signatures: [official integration documentation](https://docs.click.uz/), [official PHP reference](https://github.com/click-llc/click-integration-php). For a bank, use that bank's specific approved integration specification and hosted payment page.

Current Sold entries are explicit verified-offline-payment records entered by staff. They do not call a provider and do not claim bank verification. Full-access staff can configure merchant preparation now, then use those encrypted settings when a provider-specific implementation is commissioned and tested.
