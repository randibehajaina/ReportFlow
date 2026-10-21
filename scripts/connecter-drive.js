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
  console.log('   REPORTFLOW — CONNEXION AUTOMATIQUE À GOOGLE DRIVE (OAuth)  ');
  console.log('=============================================================\n');

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret || clientId.includes('votre_') || clientSecret.includes('votre_')) {
    console.error('ERREUR : GOOGLE_CLIENT_ID ou GOOGLE_CLIENT_SECRET manquant dans votre fichier .env\n');
    console.log('Veuillez ajouter ces deux lignes dans votre fichier .env :');
    console.log('GOOGLE_CLIENT_ID="votre_id_client"');
    console.log('GOOGLE_CLIENT_SECRET="votre_code_secret"\n');
    console.log('Puis relancez cette commande : node scripts/connecter-drive.js\n');
    process.exit(1);
  }

  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    REDIRECT_URI
  );

  // Scopes nécessaires : gestion des fichiers créés par l'app dans Drive
  const scopes = [
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/drive'
  ];

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline', // Indispensable pour recevoir le Refresh Token permanent
    prompt: 'consent',     // Force Google à renvoyer le refresh_token
    scope: scopes
  });

  // Serveur HTTP temporaire pour intercepter la réponse de Google après connexion
  const server = http.createServer(async (req, res) => {
    try {
      const parsedUrl = url.parse(req.url, true);

      if (parsedUrl.pathname === '/oauth2callback') {
        const code = parsedUrl.query.code;

        if (!code) {
          res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end('<h3>Erreur : Aucun code d\'autorisation reçu de Google.</h3>');
          return;
        }

        console.log('\nCode d\'autorisation reçu de Google ! Échange en cours...');
        const { tokens } = await oauth2Client.getToken(code);

        if (!tokens.refresh_token) {
          console.warn('\nAttention : Google n\'a pas renvoyé de refresh_token (compte déjà lié).');
        }

        const refreshToken = tokens.refresh_token;

        // Sauvegarde automatique dans le fichier .env
        const envPath = path.join(__dirname, '..', '.env');
        let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';

        if (refreshToken) {
          if (envContent.includes('GOOGLE_REFRESH_TOKEN=')) {
            envContent = envContent.replace(/GOOGLE_REFRESH_TOKEN=.*/g, `GOOGLE_REFRESH_TOKEN="${refreshToken}"`);
          } else {
            envContent += `\nGOOGLE_REFRESH_TOKEN="${refreshToken}"\n`;
          }
          fs.writeFileSync(envPath, envContent, 'utf8');
          console.log('GOOGLE_REFRESH_TOKEN enregistré avec succès dans votre fichier .env !');
        }

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; text-align: center; padding: 50px;">
            <h1 style="color: #10B981;">Connexion Google Drive réussie !</h1>
            <p style="font-size: 18px; color: #374151;">Votre compte Google personnel est maintenant lié à ReportFlow.</p>
            <p style="color: #6B7280;">Le token a été enregistré dans votre fichier <code>.env</code>.</p>
            <p style="margin-top: 30px;"><b>Vous pouvez fermer cet onglet et revenir à votre terminal.</b></p>
          </div>
        `);

        console.log('\nSUCCÈS : Configuration terminée ! Vous pouvez maintenant utiliser ReportFlow.');
        console.log('Vos documents Word seront téléversés directement sur votre Google Drive.\n');

        setTimeout(() => {
          server.close();
          process.exit(0);
        }, 1500);
      }
    } catch (err) {
      console.error('\nErreur lors de la récupération des tokens :', err.message);
      res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`<h3>Erreur : ${err.message}</h3>`);
      server.close();
      process.exit(1);
    }
  });

  server.listen(PORT, () => {
    console.log(`Serveur d'autorisation temporaire actif sur le port ${PORT}...`);
    console.log('\nCliquez sur ce lien pour autoriser ReportFlow dans votre navigateur :\n');
    console.log(`\x1b[36m${authUrl}\x1b[0m\n`);

    // Ouvre automatiquement la page dans le navigateur par défaut sous Windows via PowerShell
    const command = process.platform === 'win32'
      ? `powershell -Command "Start-Process '${authUrl}'"`
      : process.platform === 'darwin' ? `open "${authUrl}"` : `xdg-open "${authUrl}"`;

    exec(command, (err) => {
      if (err) {
        console.log('(Si la page ne s\'ouvre pas toute seule, copiez-collez le lien ci-dessus dans votre navigateur)');
      }
    });
  });
}

main().catch(console.error);
