const express = require("express");
const cors = require("cors");

const app = express();

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://projeto-barbearia-rng7cxvfx-pedros-projects-bb379b81.vercel.app",
    ],
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  })
);

app.use(express.json());

// LISTAGEM DOS SERVIÇOS - IMAGENS PREÇOS CATEGORIAS
const services = [
  {
    id: "haircut-classic",
    name: "Corte Clássico",
    description:
      "Corte de cabelo tradicional com atenção aos detalhes e acabamento impecável.",
    price: 50,
    duration: 30,
    image:
      "https://images.pexels.com/photos/1319460/pexels-photo-1319460.jpeg?auto=compress&cs=tinysrgb&w=800",
    category: "haircut",
  },
  {
    id: "haircut-fade",
    name: "Corte Fade",
    description:
      "Fade moderno com transição suave, perfeito para quem gosta de estilo contemporâneo.",
    price: 60,
    duration: 35,
    image:
      "https://images.pexels.com/photos/1805600/pexels-photo-1805600.jpeg?auto=compress&cs=tinysrgb&w=800",
    category: "haircut",
  },
  {
    id: "beard-trim",
    name: "Aparação de Barba",
    description: "Aparação precisa e modelagem de barba com produtos premium.",
    price: 35,
    duration: 25,
    image:
      "https://images.pexels.com/photos/1570807/pexels-photo-1570807.jpeg?auto=compress&cs=tinysrgb&w=800",
    category: "beard",
  },
  {
    id: "beard-design",
    name: "Design de Barba",
    description:
      "Design personalizado de barba com desenhos exclusivos e acabamento premium.",
    price: 55,
    duration: 35,
    image:
      "https://images.pexels.com/photos/1813272/pexels-photo-1813272.jpeg?auto=compress&cs=tinysrgb&w=800",
    category: "beard",
  },
  {
    id: "shaving-hot-towel",
    name: "Barbear com Toalha Quente",
    description: "Experiência premium de barbear com navalha e toalha quente.",
    price: 65,
    duration: 40,
    image:
      "https://images.pexels.com/photos/1516680/pexels-photo-1516680.jpeg?auto=compress&cs=tinysrgb&w=800",
    category: "shaving",
  },
  {
    id: "combo-haircut-beard",
    name: "Corte + Barba",
    description: "Pacote completo: corte de cabelo clássico + aparação de barba.",
    price: 80,
    duration: 60,
    image:
      "https://images.pexels.com/photos/3807517/pexels-photo-3807517.jpeg?auto=compress&cs=tinysrgb&w=800",
    category: "combo",
  },
  {
    id: "combo-full",
    name: "Pacote Completo",
    description: "Corte + Barbear com Navalha + Design de Barba + Massagem Facial.",
    price: 120,
    duration: 90,
    image:
      "https://images.pexels.com/photos/1181690/pexels-photo-1181690.jpeg?auto=compress&cs=tinysrgb&w=800",
    category: "combo",
  },
];

// INSPEÇÃO
app.get("/", (req, res) => {
  res.send("API FIX BARBEARIA rodando. Use /services e /appointments");
});

app.get("/services", (req, res) => {
  res.json(services);
});

// LISTAGEM DAS DATAS MARCADAS
const appointments = [];

const normalizePaymentMethod = (pm) => {
  if (pm === "cash") return "presencial";
  return pm;
};

app.post("/appointments", (req, res) => {
  let { items, date, time, paymentMethod, notes } = req.body;

  paymentMethod = normalizePaymentMethod(paymentMethod);

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: "Carrinho vazio." });
  }
  if (!date || !time) {
    return res.status(400).json({ message: "Data e hora são obrigatórias." });
  }
  if (!["online", "presencial"].includes(paymentMethod)) {
    return res.status(400).json({ message: "Método de pagamento inválido." });
  }

  // Valida IDs e quantidades
  const serviceIds = new Set(services.map((s) => s.id));
  for (const it of items) {
    if (!it?.serviceId || !serviceIds.has(it.serviceId)) {
      return res.status(400).json({ message: "Serviço inválido no carrinho." });
    }
    if (!Number.isInteger(it.qty) || it.qty < 1 || it.qty > 10) {
      return res.status(400).json({ message: "Quantidade inválida." });
    }
  }

  // Bloqueia conflito de horário
  const conflict = appointments.some((a) => a.date === date && a.time === time);
  if (conflict) {
    return res.status(409).json({ message: "Este horário já está reservado." });
  }

  const appointment = {
    id: Date.now().toString(),
    items,
    date,
    time,
    paymentMethod,
    notes: typeof notes === "string" && notes.trim() ? notes.trim() : undefined,
    createdAt: new Date().toISOString(),
  };

  appointments.push(appointment);
  return res.status(201).json(appointment);
});


app.get("/appointments", (req, res) => {
  res.json(appointments);
});

//app.listen(3000, () => console.log("Backend rodando em http://localhost:3000"));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Backend rodando na porta ${PORT}`));
