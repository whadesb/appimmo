const Order = require("../models/Order");

const createOrder = async (req, res) => {
    try {
        const { userId, amount, pageUrl } = req.body;

        if (!userId || !amount) {
            return res.status(400).json({ error: "userId et amount sont requis." });
        }

        const newOrder = new Order({
            userId,
            amount,
            pageUrl, // 🔹 Vérifier que pageUrl est bien stocké
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
