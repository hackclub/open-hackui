import express from 'express';
import crypto from 'crypto';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
// Disable dotenv debug tips
dotenv.config({ debug: false });

const app = express();
const port = process.env.PORT || 1826;

app.use(express.json());

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));



async function getApiKey(user) {
  try {
    const resp = await fetch(`https://auth.hackclub.com/api/v1/me`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${user.token}`
      }
    });
    if (!resp.ok) throw new Error(`Status ${resp.status}`);
    const body = await resp.json();
    const slackId = body.identity.slack_id;

    const resp2 = await fetch(`https://ai.hackclub.com/internal/keys`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ slackId: slackId, name: 'Open HackUI' })
    });

    if (!resp2.ok) throw new Error(`Status ${resp2.status}`);
    const body2 = await resp2.json();
    return body2;
  } catch (err) {
    throw err;
  }
}

async function getDummyApiKey(user) {
  try {
    // const resp = await fetch(`https://inserther.matthiaz.dev/api/key`);
    // if (!resp.ok) throw new Error(`Status ${resp.status}`);
    // const body = await resp.json();
    // return body.apiKey;
    const amsterdamTime = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Amsterdam',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(new Date());
    const randomPart = crypto.randomUUID().replace(/-/g, '').slice(0, 24);
    const apiKey = `sk_${amsterdamTime}_${randomPart}`;
    return apiKey;
  } catch (err) {
    throw err;
  }
}

async function getUserSettings(userId, userToken) {
  try {
    const resp = await fetch(`${process.env.WEBUI_URL}/api/v1/users/user/settings`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userToken}`
      }
    });
    if (!resp.ok) throw new Error(`Status ${resp.status}`);
    const body = await resp.json();
    return body;
  } catch (err) {
    throw err;
  }
}

async function updateUserSettings(userId, settings, userToken) {
  try {
    const resp = await fetch(`${process.env.WEBUI_URL}/api/v1/users/user/settings/update`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userToken}`
      },
      body: JSON.stringify(settings)
    });
    if (!resp.ok) throw new Error(`Status ${resp.status}`);
    const body = await resp.json();
    return body;
  } catch (err) {
    throw err;
  }
}

app.post('/webhook', async (req, res) => {
  console.log('Received webhook');

  const userId = req.body?.subject?.id;
  
  if (userId === undefined) {
    return res.status(400).send('Missing user in request body');
  }

  if (!process.env.WEBUI_SECRET_KEY) {
    console.error('WEBUI_SECRET_KEY is not set in environment variables');
    return res.status(500).send('Server configuration error');
  }

  const userToken = jwt.sign(
    { id: userId },
    process.env.WEBUI_SECRET_KEY,
    { expiresIn: '5m' }
  );

  try {
    const apiKey = await getDummyApiKey(userId);
    // console.log('Fetched API key:', apiKey);

    let userSettings = await getUserSettings(userId, userToken);
    // console.log('Fetched old settings:', userSettings);

    if (userSettings === null) { // this is the default if its a new account
      userSettings = {
        ui: {
          directConnections: {
            OPENAI_API_BASE_URLS: [
              `https://${process.env.PROXY_URL}/proxy/v1`
            ],
            OPENAI_API_KEYS: [
              apiKey
            ],
            OPENAI_API_CONFIGS: {
              "0": {
                enable: true,
                connection_type: "external",
                auth_type: "bearer",
                prefix_id: "",
                model_ids: [
                  "xiaomi/mimo-v2.5",
                  "qwen/qwen3.6-flash",
                  ""
                ]
              }
            }
          }
        }
      };
    } else {
      userSettings.ui.directConnections.OPENAI_API_BASE_URLS = [`https://${process.env.PROXY_URL}/proxy/v1`];
      userSettings.ui.directConnections.OPENAI_API_KEYS = [apiKey];
      userSettings.ui.directConnections.OPENAI_API_CONFIGS["0"].enable = true;
      userSettings.ui.directConnections.OPENAI_API_CONFIGS["0"].connection_type = "external";
      userSettings.ui.directConnections.OPENAI_API_CONFIGS["0"].auth_type = "bearer";
    }

    const updateResp = await updateUserSettings(userId, userSettings, userToken);
    console.log(`Updated settings for user ${userId}`);

    res.status(200).send('Webhook received');
  } catch (err) {
    console.error('Webhook handler failed:', err);
    res.status(500).send('Webhook handler failed');
  }
});

app.get('/api/key', (req, res) => {
  // ai generated
  const amsterdamTime = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Amsterdam',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date());
  const randomPart = crypto.randomUUID().replace(/-/g, '').slice(0, 24);
  const apiKey = `sk_${amsterdamTime}_${randomPart}`;
  res.json({ apiKey });
})

app.listen(port, () => {
  console.log(`Webhook server listening on port: ${port}`);
});