const express = require("express");
const cors = require("cors");

const supabase = require("./supabaseClient");

const app = express();
app.use(express.json());

// ===== CORS =====
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN; // ex: https://seu-front.vercel.app

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true); // Postman/health checks
      if (!FRONTEND_ORIGIN) return cb(null, true); // fallback: melhor setar no Render
      if (origin === FRONTEND_ORIGIN) return cb(null, true);
      return cb(new Error("CORS bloqueado para esta origem: " + origin));
    },
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// ===== HEALTH =====
app.get("/health", (req, res) => res.json({ ok: true }));

// ===== ROOT =====
app.get("/", (req, res) => {
  res.send("API FIX BARBEARIA rodando. Use /services e /appointments");
});

// ===== SERVICES (Supabase) =====
app.get("/services", async (req, res) => {
  const { data, error } = await supabase
    .from("services")
    .select("*")
    .order("category", { ascending: true });

  if (error) {
    console.error("Supabase /services error:", error);
    return res.status(500).json({ message: "Erro ao buscar serviços." });
  }

  return res.json(data);
});

// ===== HELPERS =====
const normalizePaymentMethod = (pm) => {
  if (pm === "cash") return "presencial";
  return pm;
};

async function getValidServiceIds() {
  const { data, error } = await supabase.from("services").select("id");
  if (error) throw error;
  return new Set(data.map((s) => s.id));
}

// ===== APPOINTMENTS (Supabase) =====
app.post("/appointments", async (req, res) => {
  try {
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

    // Valida IDs e quantidades consultando o banco (fonte da verdade)
    const serviceIds = await getValidServiceIds();

    for (const it of items) {
      if (!it?.serviceId || !serviceIds.has(it.serviceId)) {
        return res.status(400).json({ message: "Serviço inválido no carrinho." });
      }
      if (!Number.isInteger(it.qty) || it.qty < 1 || it.qty > 10) {
        return res.status(400).json({ message: "Quantidade inválida." });
      }
    }

    // 1) cria appointment (conflito de horário é controlado pelo unique index no banco)
    const { data: appt, error: apptErr } = await supabase
      .from("appointments")
      .insert({
        date,
        time,
        payment_method: paymentMethod,
        notes: typeof notes === "string" && notes.trim() ? notes.trim() : null,
      })
      .select("id, date, time, payment_method, notes, created_at")
      .single();

    if (apptErr) {
      // quando o horário já existe, o banco rejeita (unique index)
      console.error("Supabase insert appointments error:", apptErr);
      return res.status(409).json({ message: "Este horário já está reservado." });
    }

    // 2) cria itens
    const rows = items.map((it) => ({
      appointment_id: appt.id,
      service_id: it.serviceId,
      qty: it.qty,
    }));

    const { error: itemsErr } = await supabase.from("appointment_items").insert(rows);

    if (itemsErr) {
      console.error("Supabase insert appointment_items error:", itemsErr);
      // rollback simples
      await supabase.from("appointments").delete().eq("id", appt.id);
      return res.status(400).json({ message: "Itens inválidos no agendamento." });
    }

    return res.status(201).json({
      id: appt.id,
      date: appt.date,
      time: appt.time,
      paymentMethod: appt.payment_method,
      notes: appt.notes ?? undefined,
      createdAt: appt.created_at,
      items,
    });
  } catch (err) {
    console.error("POST /appointments unexpected error:", err);
    return res.status(500).json({ message: "Erro interno ao criar agendamento." });
  }
});

app.get("/appointments", async (req, res) => {
  const { data, error } = await supabase
    .from("appointments")
    .select(
      `
      id, date, time, payment_method, notes, created_at,
      appointment_items(service_id, qty)
    `
    )
    .order("date", { ascending: true })
    .order("time", { ascending: true });

  if (error) {
    console.error("Supabase /appointments error:", error);
    return res.status(500).json({ message: "Erro ao buscar agendamentos." });
  }

  app.get("/availability", async (req, res) => {
  try {
    const { date } = req.query;

    if (!date || typeof date !== "string") {
      return res.status(400).json({ message: "Parâmetro 'date' é obrigatório (YYYY-MM-DD)." });
    }

    const { data, error } = await supabase
      .from("appointments")
      .select("time")
      .eq("date", date);

    if (error) {
      console.error("Supabase /availability error:", error);
      return res.status(500).json({ message: "Erro ao buscar disponibilidade." });
    }

    const bookedTimes = [...new Set((data || []).map((r) => r.time))].sort();

    return res.json({
      date,
      bookedTimes, // ex: ["09:00", "10:30"]
    });
  } catch (err) {
    console.error("GET /availability unexpected error:", err);
    return res.status(500).json({ message: "Erro interno." });
  }
});


  return res.json(
    data.map((a) => ({
      id: a.id,
      date: a.date,
      time: a.time,
      paymentMethod: a.payment_method,
      notes: a.notes ?? undefined,
      createdAt: a.created_at,
      items: a.appointment_items,
    }))
  );
});

// ===== LISTEN =====
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Backend rodando na porta ${PORT}`));
