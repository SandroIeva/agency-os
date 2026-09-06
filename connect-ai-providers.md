# Connect AI Providers to i7OS

\
An API key is not included with a standard ChatGPT, Claude, or Gemini subscription. API usage may be billed separately by the respective provider.<br>

#### Before You Begin

Treat your API key like a password:

* Never publish it on a website or in a public repository.
* Do not send it via email or chat.
* Only enter it in the **AI & Models** section of i7OS.
* If a key may have been exposed publicly, revoke it and create a new one immediately.

#### Add an API Key to i7OS

The final steps are the same for all three providers:

1. Open i7OS and go to **Settings**.
2. Select **AI & Models**.
3. Choose **Gemini**, **Claude**, or **ChatGPT**.
4. Click **Edit** next to the API key field.
5. Paste your API key.
6. Click **Save**.
7. i7OS will verify the key. A confirmation will appear once the verification is successful.

You can connect multiple providers and switch the active provider later from the same section.

***

#### Claude API Key

Claude API keys are created on the **Claude Platform**, not in the regular Claude chat application.

**Create an API Key**

1. Open the [Claude Platform](https://platform.claude.com/) and sign in or create an account.
2. Open **Settings**.
3. Select **API Keys**.
4. Click **Create Key**.
5. Enter a clear name such as `i7OS`.
6. Select the appropriate workspace if Claude asks you to choose one.
7. Create the key and copy it immediately.
8. Return to i7OS and follow the steps under **Add an API Key to i7OS**.

You can also open the [Claude API Keys](https://platform.claude.com/settings/keys) page directly.

**Enable Billing for the Claude API**

A Claude Pro, Max, Team, or Enterprise subscription does not automatically include access to the Claude API.

1. On the Claude Platform, open **Settings → Billing**.
2. Add a payment method if required.
3. Purchase usage credits.
4. Optionally, configure automatic top-ups and a spending limit.

If your credits run out, Claude requests from i7OS will stop working until additional credits are added.

***

#### Gemini API Key

Gemini API keys are created in **Google AI Studio**.

**Create an API Key**

1. Open the [API Keys](https://aistudio.google.com/app/apikey) page in Google AI Studio.
2. Sign in with your Google account and accept the terms of service if required.
3. Click **Create API key**.
4. Select an existing Google Cloud project or create a new one.
5. Enter a clear name such as `i7OS` if this option is available.
6. Copy the new API key.
7. Return to i7OS and follow the steps under **Add an API Key to i7OS**.

\{% hint style="info" %\}\
For new users, Google AI Studio may automatically create a default Google Cloud project and an API key after the terms of service have been accepted.\
\{% endhint %\}

**Enable Billing for the Gemini API**

Google may provide a limited free tier. Billing must be enabled for higher limits and paid usage.

1. In Google AI Studio, open **Dashboard → Billing**, **Projects**, or **API Keys**.
2. Click **Set up billing** if paid access is required.
3. Link an existing Google Cloud billing account or create a new one.
4. Set a budget or spending alert in Google Cloud.

If you cannot create a key, check whether you are the owner of the selected Google Cloud project or have permission to create API keys.

***

#### ChatGPT/OpenAI API Key

ChatGPT models are connected to i7OS using an **OpenAI API key**. The key is created on the OpenAI Platform, not inside ChatGPT.

**Create an API Key**

1. Open the [API Keys](https://platform.openai.com/api-keys) page on the OpenAI Platform.
2. Sign in or create an OpenAI Platform account.
3. Select the correct project if you have more than one.
4. Click **Create new secret key**.
5. Enter a clear name such as `i7OS`.
6. Confirm the permissions. The default settings are sufficient for most i7OS users.
7. Create the key and copy it immediately. OpenAI may not display the complete key again later.
8. Return to i7OS and follow the steps under **Add an API Key to i7OS**.

**Enable Billing for the OpenAI API**

ChatGPT Free, Plus, Pro, Business, or Enterprise subscriptions and OpenAI API usage have separate billing systems.

1. Open the [OpenAI Platform billing settings](https://platform.openai.com/settings/organization/billing/overview).
2. Add a payment method or purchase prepaid credits.
3. Open the **Limits** section in the OpenAI Platform settings.
4. Set a monthly usage limit that fits your budget.

Without API credits or a configured payment method, the key may be valid while requests from i7OS still fail.

***

#### Troubleshooting

**i7OS Reports That the Key Is Invalid**

* Check that you copied the complete key without spaces before or after it.
* Make sure the key belongs to the provider selected in i7OS.
* Check whether API billing or usage credits have been activated.
* Make sure the key has not been deleted, revoked, suspended, or incorrectly restricted.
* Create a new key if the original key may have been exposed publicly.

**The Key Is Valid, but the AI Does Not Respond**

* Check the provider’s usage dashboard to see whether your credits have run out or a limit has been reached.
* Make sure the selected model is available for your API account.
* Wait briefly and try again if the provider is temporarily limiting requests.
* Switch to another connected provider under **Settings → AI & Models**.

**Replace or Remove an API Key**

1. In i7OS, open **Settings → AI & Models**.
2. Select the provider.
3. Click **Edit** to replace the key or **Reset** to remove it.
4. If you no longer use the old key, revoke it in the provider’s dashboard as well.

#### Official Documentation

* [Accessing the Claude API](https://support.claude.com/en/articles/8114521-how-can-i-access-the-anthropic-api)
* [Gemini API Keys](https://ai.google.dev/gemini-api/docs/api-key)
* [OpenAI API Quickstart](https://platform.openai.com/docs/quickstart)
