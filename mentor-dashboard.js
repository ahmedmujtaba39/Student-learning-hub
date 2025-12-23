

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// DOM elements
const mentorNameBar = document.getElementById("mentorName");
const slotInput = document.getElementById("slotInput");
const addSlotBtn = document.getElementById("addSlotBtn");
const slotList = document.getElementById("slotList");
const bookingsTable = document.getElementById("bookingsTable");
const logoutBtn = document.getElementById("logoutBtn");

let mentorDocId = null;    // the Firestore document ID for this mentor
let mentorRef = null;

// 🔒 AUTH STATE
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    // Not logged in → go to login page
    window.location.href = "mentor-login.html";
    return;
  }

  const userEmail = user.email;

  // Find mentor document where email == userEmail
  const mentorsRef = collection(db, "mentors");
  const q = query(mentorsRef, where("email", "==", userEmail));
  const snap = await getDocs(q);

  if (snap.empty) {
    alert("No mentor profile found for " + userEmail);
    return;
  }

  // Take the first matching doc
  const docSnap = snap.docs[0];
  mentorDocId = docSnap.id;
  mentorRef = doc(db, "mentors", mentorDocId);

  const data = docSnap.data();
  mentorNameBar.textContent = "Logged in as: " + (data.name || userEmail);

  // Load dashboard data
  await loadSlots();
  loadBookings();
});

// Load slots
async function loadSlots() {
  const snap = await getDoc(mentorRef);
  if (!snap.exists()) return;

  const data = snap.data();
  const slots = data.slots || [];

  slotList.innerHTML = "";

  slots.forEach(slot => {
    const el = document.createElement("div");
    el.className = "slot-item";
    el.innerHTML = `
      ${new Date(slot).toLocaleString()}
      <span class="delete-slot" data-slot="${slot}">X</span>
    `;
    slotList.appendChild(el);
  });

  document.querySelectorAll(".delete-slot").forEach(btn => {
    btn.addEventListener("click", removeSlot);
  });
}

// Add slot
addSlotBtn.addEventListener("click", async () => {
  const val = slotInput.value;
  if (!val) {
    alert("Choose a date and time.");
    return;
  }

  await updateDoc(mentorRef, {
    slots: arrayUnion(val)
  });

  slotInput.value = "";
  loadSlots();
});

// Remove slot
async function removeSlot(e) {
  const slot = e.target.dataset.slot;

  await updateDoc(mentorRef, {
    slots: arrayRemove(slot)
  });

  loadSlots();
}

// Load bookings
function loadBookings() {
  const bookingsRef = collection(db, "bookings");
  const q = query(bookingsRef, where("mentorId", "==", mentorDocId));

  onSnapshot(q, snapshot => {
    bookingsTable.innerHTML = "";
    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      bookingsTable.innerHTML += `
        <tr>
          <td>${data.studentName}</td>
          <td>${data.studentEmail}</td>
          <td>${new Date(data.slot).toLocaleString()}</td>
        </tr>
      `;
    });
  });
}

// Logout
logoutBtn.addEventListener("click", () => {
  signOut(auth).then(() => {
    window.location.href = "mentor-login.html";
  });
});

addSlotBtn.addEventListener("click", async () => {
  const val = slotInput.value;
  if (!val) {
    alert("Choose a date and time.");
    return;
  }

  try {
    console.log("Adding slot:", val);
    await updateDoc(mentorRef, {
      slots: arrayUnion(val)
    });
    console.log("Slot added");
    slotInput.value = "";
    loadSlots();
  } catch (err) {
    console.error("Slot error:", err);
    alert("Firestore error — check console");
  }
});
