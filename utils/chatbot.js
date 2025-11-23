const { NlpManager } = require('node-nlp');
const fs = require('fs');
const path = require('path');

const manager = new NlpManager({ languages: ['fr'], forceNER: true, nlu: { log: false } });

async function trainChatbot() {
    console.log('🧠 Démarrage du module Chatbot...');

    // 1. SUPPRESSION AUTOMATIQUE DE L'ANCIEN CERVEAU
    // Cela force le bot à apprendre les nouvelles phrases à chaque redémarrage
    const modelPath = path.join(__dirname, '../model.nlp');
    if (fs.existsSync(modelPath)) {
        fs.unlinkSync(modelPath);
        console.log('🗑️ Ancien modèle supprimé pour mise à jour.');
    }

    // 2. ENTRAÎNEMENT
    console.log('📚 Apprentissage des nouvelles phrases...');

    // --- INTENTION : SALUTATIONS ---
    manager.addDocument('fr', 'bonjour', 'greetings.hello');
    manager.addDocument('fr', 'salut', 'greetings.hello');
    manager.addDocument('fr', 'coucou', 'greetings.hello');
    manager.addAnswer('fr', 'greetings.hello', 'Bonjour ! Je suis l\'assistant UAP.');

    // --- INTENTION : CRÉATION D'ANNONCE (Celle qui posait problème) ---
    manager.addDocument('fr', 'comment créer une annonce', 'property.create');
    manager.addDocument('fr', 'créer annonce', 'property.create');
    manager.addDocument('fr', 'ajouter une propriété', 'property.create');
    manager.addDocument('fr', 'je veux vendre', 'property.create');
    manager.addDocument('fr', 'publier un bien', 'property.create');
    manager.addDocument('fr', 'mise en ligne', 'property.create');
    manager.addDocument('fr', 'nouvelle annonce', 'property.create');
    manager.addDocument('fr', 'je veux ajouter un bien', 'property.create');
    
    // Pas de réponse texte ici, car le serveur gère l'action (bouton)

    // --- INTENTION : COMMANDES ---
    manager.addDocument('fr', 'mes commandes', 'order.status');
    manager.addDocument('fr', 'voir mes achats', 'order.status');
    manager.addDocument('fr', 'statut commande', 'order.status');
    manager.addDocument('fr', 'suivi commande', 'order.status');

    // --- INTENTION : MOT DE PASSE ---
    manager.addDocument('fr', 'mot de passe oublié', 'account.password');
    manager.addDocument('fr', 'changer mot de passe', 'account.password');

    // --- INTENTION : AIDE ---
    manager.addDocument('fr', 'aide', 'agent.help');
    manager.addDocument('fr', 'help', 'agent.help');
    manager.addAnswer('fr', 'agent.help', 'Je peux vous aider sur vos commandes, votre compte ou la création d\'annonce.');

    await manager.train();
    manager.save();
    console.log('🚀 Chatbot mis à jour et prêt !');
}

module.exports = { manager, trainChatbot };
```

### Étape 2 : Vérifier la logique de réponse (`server.js`)

Assurez-vous que votre `server.js` contient bien le bloc `if` pour `property.create` et le log de débogage pour voir ce qui se passe.

Vérifiez (ou remplacez) votre route `/api/chat` dans **`server.js`** :

```javascript
// DANS server.js

app.post('/api/chat', isAuthenticated, isAdmin, async (req, res) => {
    const { message } = req.body;
    const user = req.user;

    try {
        const result = await manager.process('fr', message);
        
        // 🔍 CE LOG EST CRUCIAL : Regardez votre console serveur quand vous parlez !
        console.log(`🤖 Chatbot a reçu : "${message}"`);
        console.log(`   ↳ Intention détectée : "${result.intent}" (Score: ${result.score})`);

        // Seuil de tolérance (0.5 est bien pour commencer)
        if (result.score < 0.5 || result.intent === 'None') {
            return res.json({ 
                response: "Je ne suis pas sûr de comprendre. Essayez 'Ajouter un bien' ou 'Mes commandes'.", 
                intent: 'None',
                action: null 
            });
        }

        let answer = result.answer;
        let action = null;

        // --- GESTION DES ACTIONS ---

        // 1. Création d'annonce
        if (result.intent === 'property.create') {
            answer = "C'est très simple ! Cliquez ci-dessous pour ouvrir le formulaire de création.";
            action = { 
                type: 'section_trigger', 
                target: 'landing', 
                text: 'Créer une annonce maintenant' 
            };
        }

        // 2. Commandes
        if (result.intent === 'order.status') {
            // ... (votre code commandes existant)
            const lastOrder = await Order.findOne({ userId: user._id }).sort({ createdAt: -1 });
            if (lastOrder) {
                 answer = `Dernière commande : ${lastOrder.orderId} (${lastOrder.status})`;
            } else {
                 answer = "Aucune commande trouvée.";
            }
        }
        
        // 3. Mot de passe
        if (result.intent === 'account.password') {
             answer = "Cliquez ci-dessous pour réinitialiser.";
             action = { type: 'link', text: 'Changer mot de passe', url: `/${req.locale}/forgot-password` };
        }

        // Réponse par défaut si l'intention est reconnue mais pas gérée spécifiquement ci-dessus
        if (!answer) {
            answer = "J'ai compris votre demande, mais je n'ai pas d'information précise à ce sujet pour le moment.";
        }

        res.json({ response: answer, intent: result.intent, action: action });

    } catch (error) {
        console.error('Erreur Chatbot:', error);
        res.status(500).json({ response: "Erreur interne." });
    }
});
