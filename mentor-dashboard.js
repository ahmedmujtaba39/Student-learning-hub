import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import {
  getFirestore, doc, getDoc, updateDoc, addDoc,
  collection, query, where, getDocs, onSnapshot,
  arrayUnion, arrayRemove
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import {
  getAuth, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyCfY56_OCn_mxtHXDNIZC5bnKZKCSj-r7o",
  authDomain: "student-learning-hub-1ca09.firebaseapp.com",
  projectId: "student-learning-hub-1ca09",
  storageBucket: "student-learning-hub-1ca09.appspot.com",
  messagingSenderId: "20340802436",
  appId: "1:20340802436:web:d604f4c9f3fb119f56d3d1",
  measurementId: "G-N4KT84Q6MR"
};

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);
const auth = getAuth(app);

// DOM elements
const mentorNameBar  = document.getElementById("mentorName");
const slotInput      = document.getElementById("slotInput");
const addSlotBtn     = document.getElementById("addSlotBtn");
const slotList       = document.getElementById("slotList");
const bookingsTable  = document.getElementById("bookingsTable");
const logoutBtn      = document.getElementById("logoutBtn");
const profileEmail   = document.getElementById("profileEmail");
const saveProfileBtn = document.getElementById("saveProfileBtn");
const profileMsg     = document.getElementById("profileMsg");

let mentorDocId = null;
let mentorRef   = null;

/* ── Auth guard ──────────────────────────────────────────────────────────── */
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "mentor-login.html";
    return;
  }

  const userEmail = user.email;

  const q    = query(collection(db, "mentors"), where("email", "==", userEmail));
  const snap = await getDocs(q);

  if (snap.empty) {
    // First login — create a mentor document automatically
    const newRef = await addDoc(collection(db, "mentors"), {
      name:  userEmail.split("@")[0],
      email: userEmail,
      slots: [],
    });
    mentorDocId = newRef.id;
    mentorRef   = doc(db, "mentors", mentorDocId);
  } else {
    const docSnap = snap.docs[0];
    mentorDocId = docSnap.id;
    mentorRef   = doc(db, "mentors", mentorDocId);
    const data  = docSnap.data();
    mentorNameBar.textContent = "Logged in as: " + (data.name || userEmail);
    if (profileEmail) profileEmail.value = data.email || userEmail;
  }

  await loadSlots();
  loadBookings();
});

/* ── Profile: save mentor email (used for booking confirmations) ── */
if (saveProfileBtn) {
  saveProfileBtn.addEventListener("click", async () => {
    const email = profileEmail.value.trim();
    if (!email) return;
    try {
      await updateDoc(mentorRef, { email });
      profileMsg.style.color = "green";
      profileMsg.textContent = "Email saved!";
    } catch (err) {
      profileMsg.style.color = "red";
      profileMsg.textContent = "Error saving email.";
    }
  });
}

/* ── Load available slots ─────────────────────────────────────────────── */
async function loadSlots() {
  const snap = await getDoc(mentorRef);
  if (!snap.exists()) return;

  const slots = snap.data().slots || [];
  slotList.innerHTML = "";

  if (slots.length === 0) {
    slotList.innerHTML = "<p style='color:#888;font-size:14px'>No slots added yet.</p>";
    return;
  }

  slots.forEach(slot => {
    const el = document.createElement("div");
    el.className = "slot-item";
    el.innerHTML = `
      ${new Date(slot).toLocaleString()}
      <span class="delete-slot" data-slot="${slot}">✕ Remove</span>
    `;
    slotList.appendChild(el);
  });

  document.querySelectorAll(".delete-slot").forEach(btn => {
    btn.addEventListener("click", removeSlot);
  });
}

/* ── Add slot ─────────────────────────────────────────────────────────── */
addSlotBtn.addEventListener("click", async () => {
  const val = slotInput.value;
  if (!val) {
    alert("Choose a date and time.");
    return;
  }

  try {
    await updateDoc(mentorRef, { slots: arrayUnion(val) });
    slotInput.value = "";
    loadSlots();
  } catch (err) {
    console.error("Add slot error:", err);
    alert("Could not add slot — check console.");
  }
});

/* ── Remove slot ──────────────────────────────────────────────────────── */
async function removeSlot(e) {
  const slot = e.target.dataset.slot;
  try {
    await updateDoc(mentorRef, { slots: arrayRemove(slot) });
    loadSlots();
  } catch (err) {
    console.error("Remove slot error:", err);
  }
}

/* ── Load bookings (live) ─────────────────────────────────────────────── */
function loadBookings() {
  const q = query(collection(db, "bookings"), where("mentorId", "==", mentorDocId));

  onSnapshot(q, snapshot => {
    bookingsTable.innerHTML = "";

    if (snapshot.empty) {
      bookingsTable.innerHTML = `
        <tr><td colspan="4" style="text-align:center;color:#888">No bookings yet.</td></tr>
      `;
      return;
    }

    snapshot.forEach(docSnap => {
      const d = docSnap.data();
      const meetCell = d.meetLink
        ? `<a href="${d.meetLink}" target="_blank" style="color:#1a73e8;font-weight:600">Join Meet</a>`
        : `<span style="color:#aaa">—</span>`;

      bookingsTable.innerHTML += `
        <tr>
          <td>${d.studentName}</td>
          <td>${d.studentEmail}</td>
          <td>${new Date(d.slot).toLocaleString()}</td>
          <td>${meetCell}</td>
        </tr>
      `;
    });
  });
}

/* ── Logout ───────────────────────────────────────────────────────────── */
logoutBtn.addEventListener("click", () => {
  signOut(auth).then(() => {
    window.location.href = "mentor-login.html";
  });
});
