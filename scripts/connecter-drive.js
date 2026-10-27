require('dotenv').config();
const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { google } = require('googleapis');

const PORT = 3001;
const REDIRECT_URI = `http://localhost:${PORT}/oauth2callback`;

async function main() {
  console.log('\n=============================================================');
  console.log('   REPORTFLOW — Configuration OAuth 2.0 (Google Drive)');
  console.log('=============================================================\n');

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret || clientId.includes('votre_') || clientSecret.includes('votre_')) {
    console.error('Erreur : GOOGLE_CLIENT_ID ou GOOGLE_CLIENT_SECRET non définis dans .env\n');
    console.log('Renseigner les variables suivantes dans le fichier .env :');
    console.log('GOOGLE_CLIENT_ID="<client_id>"');
    console.log('GOOGLE_CLIENT_SECRET="<client_secret>"\n');
    process.exit(1);
  }

  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    REDIRECT_URI
  );

  // Périmètre des autorisations requises (Google Drive)
  const scopes = [
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/drive'
  ];

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline', // Obtention du refresh token
    prompt: 'consent',     // Forcer l'envoi du refresh_token
    scope: scopes
  });

  // Serveur HTTP temporaire d'écoute du callback OAuth
  const server = http.createServer(async (req, res) => {
    try {
      const parsedUrl = url.parse(req.url, true);

      if (parsedUrl.pathname === '/oauth2callback') {
        const code = parsedUrl.query.code;

        if (!code) {
          res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end('<h3>Erreur : Aucun code d\'autorisation reçu.</h3>');
          return;
        }

        console.log('\nCode d\'autorisation reçu. Échange du jeton en cours...');
        const { tokens } = await oauth2Client.getToken(code);

        if (!tokens.refresh_token) {
          console.warn('\nNote : Aucun refresh_token retourné (autorisation déjà existante).');
        }

        const refreshToken = tokens.refresh_token;

        // Persistance du refresh token dans le fichier .env
        const envPath = path.join(__dirname, '..', '.env');
        let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';

        if (refreshToken) {
          if (envContent.includes('GOOGLE_REFRESH_TOKEN=')) {
            envContent = envContent.replace(/GOOGLE_REFRESH_TOKEN=.*/g, `GOOGLE_REFRESH_TOKEN="${refreshToken}"`);
          } else {
            envContent += `\nGOOGLE_REFRESH_TOKEN="${refreshToken}"\n`;
          }
          fs.writeFileSync(envPath, envContent, 'utf8');
          console.log('GOOGLE_REFRESH_TOKEN enregistré dans le fichier .env.');
        }

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; text-align: center; padding: 50px;">
            <h1 style="color: #10B981;">Authentification Google Drive validée</h1>
            <p style="font-size: 18px; color: #374151;">Le jeton d'accès a été configuré avec succès.</p>
            <p style="color: #6B7280;">Vous pouvez fermer cette fenêtre.</p>
          </div>
        `);

        console.log('\nConfiguration OAuth 2.0 validée avec succès.\n');

        setTimeout(() => {
          server.close();
          process.exit(0);
        }, 1500);
      }
    } catch (err) {
      console.error('\nErreur lors de l\'échange de jeton :', err.message);
      res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`<h3>Erreur : ${err.message}</h3>`);
      server.close();
      process.exit(1);
    }
  });

  server.listen(PORT, () => {
    console.log(`Serveur d'autorisation actif sur le port ${PORT}...`);
    console.log('\nURL d\'autorisation :\n');
    console.log(`\x1b[36m${authUrl}\x1b[0m\n`);

    // Ouverture automatique du navigateur hôte
    const command = process.platform === 'win32'
      ? `powershell -Command "Start-Process '${authUrl}'"`
      : process.platform === 'darwin' ? `open "${authUrl}"` : `xdg-open "${authUrl}"`;

    exec(command, (err) => {
      if (err) {
        console.log('(Ouverture manuelle : veuillez copier l\'URL ci-dessus dans un navigateur)');
      }
    });
  });
}

main().catch(console.error);
