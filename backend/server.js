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
      // Permite requests sem origin (Postman/health checks)
      if (!origin) return cb(null, true);

      // Em produção, SETE FRONTEND_ORIGIN no Render. Esse fallback é só pra não travar debug.
      if (!FRONTEND_ORIGIN) return cb(null, true);

      if (origin === FRONTEND_ORIGIN) return cb(null, true);
      return cb(new Error("CORS bloqueado para esta origem: " + origin));
    },
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// ===== HEALTH / ROOT =====
app.get("/health", (req, res) => res.json({ ok: true }));

app.get("/", (req, res) => {
  res.send("API FIX BARBEARIA rodando. Use /services, /appointments e /availability");
});

// ===== HELPERS =====
const normalizePaymentMethod = (pm) => {
  if (pm === "cash") return "presencial";
  return pm;
};

function toMinutes(hhmm) {
  const [h, m] = String(hhmm).split(":").map(Number);
  return h * 60 + m;
}

function overlaps(startA, endA, startB, endB) {
  // intervalos [start, end)
  return startA < endB && startB < endA;
}

async function getValidServiceIds() {
  const { data, error } = await supabase.from("services").select("id");
  if (error) throw error;
  return new Set((data || []).map((s) => s.id));
}

async function getDurationByServiceId() {
  const { data, error } = await supabase.from("services").select("id, duration");
  if (error) throw error;

  const map = new Map();
  for (const s of data || []) map.set(s.id, s.duration);
  return map;
}

async function getExistingBlocksForDate(date) {
  const { data, error } = await supabase
    .from("appointments")
    .select("time, appointment_items(service_id, qty)")
    .eq("date", date);

  if (error) throw error;
  return data || [];
}

function normalizeNotes(notes) {
  return typeof notes === "string" && notes.trim() ? notes.trim() : null;
}

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

// ===== AVAILABILITY (Supabase) =====
// Retorna blocos do dia: [{ time: "17:00", totalMinutes: 45 }, ...]
app.get("/availability", async (req, res) => {
  try {
    const { date } = req.query;

    if (!date || typeof date !== "string") {
      return res
        .status(400)
        .json({ message: "Parâmetro 'date' é obrigatório (YYYY-MM-DD)." });
    }

    const appts = await getExistingBlocksForDate(date);
    const durationById = await getDurationByServiceId();

    const blocks = (appts || []).map((a) => {
      const totalMinutes = (a.appointment_items || []).reduce((sum, it) => {
        const dur = durationById.get(it.service_id) || 0;
        return sum + dur * (it.qty || 1);
      }, 0);

      return { time: a.time, totalMinutes };
    });

    return res.json({ date, blocks });
  } catch (err) {
    console.error("GET /availability unexpected error:", err);
    return res.status(500).json({ message: "Erro interno." });
  }
});

// ===== APPOINTMENTS (Supabase) =====
app.post("/appointments", async (req, res) => {
  try {
    let { userId, items, date, time, paymentMethod, notes } = req.body;

    paymentMethod = normalizePaymentMethod(paymentMethod);
    if (!userId || typeof userId !== "string") {
      return res.status(401).json({ message: "Usuário não autenticado." });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "Carrinho vazio." });
    }
    if (!date || !time) {
      return res.status(400).json({ message: "Data e hora são obrigatórias." });
    }
    if (!["online", "presencial"].includes(paymentMethod)) {
      return res.status(400).json({ message: "Método de pagamento inválido." });
    }

    // 1) Validar IDs e qty
    const validIds = await getValidServiceIds();

    for (const it of items) {
      if (!it?.serviceId || !validIds.has(it.serviceId)) {
        return res.status(400).json({ message: "Serviço inválido no carrinho." });
      }
      if (!Number.isInteger(it.qty) || it.qty < 1 || it.qty > 10) {
        return res.status(400).json({ message: "Quantidade inválida." });
      }
    }

    // 2) BLOQUEIO DE SOBREPOSIÇÃO REAL (por duração)
    const durationById = await getDurationByServiceId();

    const requestedMinutes = items.reduce((sum, it) => {
      const dur = durationById.get(it.serviceId) || 0;
      return sum + dur * it.qty;
    }, 0);

    const reqStart = toMinutes(time);
    const reqEnd = reqStart + requestedMinutes;

    const existing = await getExistingBlocksForDate(date);

    for (const a of existing) {
      const aStart = toMinutes(a.time);

      const aMinutes = (a.appointment_items || []).reduce((sum, it) => {
        const dur = durationById.get(it.service_id) || 0;
        return sum + dur * (it.qty || 1);
      }, 0);

      const aEnd = aStart + aMinutes;

      if (overlaps(reqStart, reqEnd, aStart, aEnd)) {
        return res.status(409).json({
          message: "Este horário conflita com outro agendamento.",
        });
      }
    }

    // 3) Criar appointment
    const { data: appt, error: apptErr } = await supabase
      .from("appointments")
      .insert({
        user_id: userId,
        date,
        time,
        payment_method: paymentMethod,
        notes: normalizeNotes(notes),
      })
      .select("id, date, time, payment_method, notes, created_at")
      .single();

    if (apptErr) {
      console.error("Supabase insert appointments error:", apptErr);
      // Se ainda existir conflito por UNIQUE(date,time), trate como ocupado
      return res.status(409).json({ message: "Este horário já está reservado." });
    }

    // 4) Criar itens
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

  return res.json(
    (data || []).map((a) => ({
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
