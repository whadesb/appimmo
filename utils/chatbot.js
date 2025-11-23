const { NlpManager } = require('node-nlp');
const fs = require('fs');

// Création du manager pour le français
const manager = new NlpManager({ languages: ['fr'], forceNER: true, nlu: { log: false } });

async function trainChatbot() {
    console.log('🧠 Début de l\'entraînement du Chatbot...');

    // --- 1. SALUTATIONS (greetings.hello) ---
    manager.addDocument('fr', 'bonjour', 'greetings.hello');
    manager.addDocument('fr', 'bonsoir', 'greetings.hello');
    manager.addDocument('fr', 'salut', 'greetings.hello');
    manager.addDocument('fr', 'hello', 'greetings.hello');
    manager.addDocument('fr', 'coucou', 'greetings.hello');
    manager.addDocument('fr', 'yo', 'greetings.hello');
    
    manager.addAnswer('fr', 'greetings.hello', 'Bonjour ! Je suis l\'assistant UAP. Comment puis-je vous aider ?');
    manager.addAnswer('fr', 'greetings.hello', 'Salut ! Que puis-je faire pour vous aujourd\'hui ?');

    // --- 2. COMMANDES (order.status) ---
    // On ajoute plein de variations pour qu'il comprenne
    manager.addDocument('fr', 'mes commandes', 'order.status');
    manager.addDocument('fr', 'voir mes commandes', 'order.status');
    manager.addDocument('fr', 'où sont mes commandes', 'order.status');
    manager.addDocument('fr', 'statut commande', 'order.status');
    manager.addDocument('fr', 'j\'ai commandé quoi', 'order.status');
    manager.addDocument('fr', 'suivi de commande', 'order.status');
    manager.addDocument('fr', 'mes achats', 'order.status');
    manager.addDocument('fr', 'historique', 'order.status');
    manager.addDocument('fr', 'quelles sont mes dernières commandes', 'order.status');
    manager.addDocument('fr', 'je veux voir mes factures', 'order.status');

    // --- 3. MOT DE PASSE (account.password) ---
    manager.addDocument('fr', 'mot de passe oublié', 'account.password');
    manager.addDocument('fr', 'changer mot de passe', 'account.password');
    manager.addDocument('fr', 'réinitialiser mdp', 'account.password');
    manager.addDocument('fr', 'je ne peux plus me connecter', 'account.password');
    manager.addDocument('fr', 'problème mot de passe', 'account.password');

    // --- 4. PAIEMENT & CRYPTO (payment.btc) ---
    manager.addDocument('fr', 'payer en bitcoin', 'payment.btc');
    manager.addDocument('fr', 'crypto', 'payment.btc');
    manager.addDocument('fr', 'btcpay', 'payment.btc');
    manager.addDocument('fr', 'comment payer en crypto', 'payment.btc');
    manager.addDocument('fr', 'moyens de paiement', 'payment.btc');
    
    manager.addAnswer('fr', 'payment.btc', 'Nous acceptons PayPal et Bitcoin via BTCPay Server. C\'est sécurisé et rapide.');

    // --- 5. AIDE GÉNÉRALE (agent.help) ---
    manager.addDocument('fr', 'aide', 'agent.help');
    manager.addDocument('fr', 'help', 'agent.help');
    manager.addDocument('fr', 'je suis perdu', 'agent.help');
    manager.addDocument('fr', 'comment ça marche', 'agent.help');
    
    manager.addAnswer('fr', 'agent.help', 'Je peux vous renseigner sur vos commandes, la création d\'annonce ou la gestion de votre compte.');

    // Lancement de l'entraînement
    await manager.train();
    manager.save();
    console.log('🚀 Chatbot entraîné et prêt !');
}

// Si le modèle existe déjà, on le charge, sinon on entraîne
if (fs.existsSync('./model.nlp')) {
    manager.load();
    console.log('📂 Modèle NLP chargé depuis le disque.');
} else {
    // On lancera l'entraînement au démarrage du serveur
}

module.exports = { manager, trainChatbot };
