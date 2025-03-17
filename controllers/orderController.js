const Order = require("../models/Order");
const getNextOrderId = require("../utils/getNextOrderId"); // 🔹 Import de la fonction pour générer l'Order ID

const createOrder = async (req, res) => {
    try {
        const { userId, amount, pageUrl } = req.body;

        if (!userId || !amount) {
            return res.status(400).json({ error: "userId et amount sont requis." });
        }

        // 🔹 Génération d'un Order ID unique
        const orderId = await getNextOrderId();

        const newOrder = new Order({
            orderId,  // 🔹 Ajout de l'Order ID formaté ex: "ORD-1001"
            userId,
            amount,
            pageUrl, // 🔹 Stocke correctement pageUrl
            status: "pending"
        });

        await newOrder.save();
        res.status(201).json(newOrder);
    } catch (error) {
        console.error("Erreur lors de la création de la commande :", error);
        res.status(500).json({ error: "Erreur serveur" });
    }
};

module.exports = { createOrder };
