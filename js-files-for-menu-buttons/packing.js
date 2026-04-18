// =============================
// 📦 STATE (Data Layer)
// =============================

// Main data: all orders
let orders = [];

// Load saved orders from localStorage (if exists)
const savedOrders = localStorage.getItem('orders');

if (savedOrders) {
  orders = JSON.parse(savedOrders);
}

// =============================
// 📌 DOM REFERENCES (UI Elements)
// =============================

const fileInput = document.getElementById('fileInput');
const orderList = document.getElementById('orderList');
const searchInput = document.getElementById('searchInput');

// =============================
// 🎛️ BUTTONS & EVENTS
// =============================

// Toggle dark mode
document.getElementById('darkModeBtn').onclick = () => {
  document.body.classList.toggle('dark-mode');
};

// Export report
document.getElementById('exportBtn').onclick = exportData;

// Clear all data
document.getElementById('clearBtn').onclick = clearAll;

// Search filtering
searchInput.addEventListener('keyup', filter);

// File upload
fileInput.addEventListener('change', handleFile);

// =============================
// 📤 FILE UPLOAD → PARSE CSV/XLSX
// =============================

function handleFile(e) {
  const file = e.target.files[0];
  const reader = new FileReader();

  reader.onload = function (e) {
    const data = new Uint8Array(e.target.result);

    // Read Excel file
    const wb = XLSX.read(data, { type: 'array' });

    // Convert to JSON
    const raw = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {
      defval: '',
    });

    // =============================
    // 🧠 TRANSFORM DATA → GROUP BY ORDER
    // =============================

    const map = new Map();

    raw.forEach((row) => {
      const id = row.Name;

      // Create new order if not exists
      if (!map.has(id)) {
        map.set(id, {
          id,
          customer: row['Billing Name'] || 'N/A',
          items: [],
          itemMap: {}, // temp structure to avoid duplicates
        });
      }

      const order = map.get(id);

      const itemKey = row['Lineitem name']?.toLowerCase().trim();

      // Avoid duplicate items (important!)
      if (!order.itemMap[itemKey]) {
        order.itemMap[itemKey] = {
          name: row['Lineitem name'],
          qty: Number(row['Lineitem quantity']),
          fulfilledQty: Number(row['Lineitem fulfilled quantity']) || 0,
          packedQty: 0,
          vendor: row['Vendor'] || 'Unknown',
          fulfillmentStatus:
            row['Lineitem fulfillment status']?.toLowerCase() || 'unfulfilled',
          rowRef: row,
        };
      }
    });

    // Convert map → array
    orders = Array.from(map.values()).map((order) => {
      order.items = Object.values(order.itemMap);
      delete order.itemMap;
      return order;
    });

    // Save to localStorage
    localStorage.setItem('orders', JSON.stringify(orders));

    // Render UI
    render();
  };

  reader.readAsArrayBuffer(file);
}

// =============================
// 📊 RENDER PACKING UI
// =============================

function render() {
  orderList.innerHTML = '';

  orders.forEach((order, oIdx) => {
    // Count completed items
    const packedCount = order.items.filter((item) => {
      const remainingQty = item.qty - (item.fulfilledQty || 0);
      return item.packedQty === remainingQty;
    }).length;

    const isComplete =
      packedCount === order.items.length && order.items.length > 0;

    const isPartial = packedCount > 0 && packedCount < order.items.length;

    // Create order card
    const card = document.createElement('div');
    card.className = `order-card ${
      isComplete ? 'complete' : isPartial ? 'partial' : ''
    }`;

    card.innerHTML = `
      <div><b>Order ${order.id}</b></div>
      <div>${order.customer}</div>
      <div>Checked: ${packedCount}/${order.items.length}</div>
    `;

    // =============================
    // 🧱 ITEMS LOOP
    // =============================

    order.items.forEach((item, iIdx) => {
      const remainingQty = item.qty - (item.fulfilledQty || 0);

      // Status label
      let statusLabel = '';

      if (item.fulfillmentStatus === 'fulfilled') {
        statusLabel = `<span class="fulfilled-label">Fulfilled</span>`;
      } else if (item.fulfillmentStatus === 'partial') {
        statusLabel = `<span class="partial-label">Partial</span>`;
      } else {
        statusLabel = `<span class="unfulfilled-label">Unfulfilled</span>`;
      }

      const row = document.createElement('div');
      row.className = 'item-row';

      row.innerHTML = `
        <span class="item-name">${item.name}</span>
        <span class="vendor">${item.vendor}</span>

        <input 
          type="number" 
          min="0" 
          max="${remainingQty}" 
          value="${item.packedQty}" 
          class="qty-input"
        >

        <button class="full-btn">FULL</button>

        <b>x${remainingQty}</b>
        ${statusLabel}
      `;

      const input = row.querySelector('input');
      const fullBtn = row.querySelector('.full-btn');

      // =============================
      // 🔥 FULL BUTTON
      // =============================

      if (fullBtn) {
        fullBtn.addEventListener('click', () => {
          orders[oIdx].items[iIdx].packedQty = remainingQty;

          // Save state
          localStorage.setItem('orders', JSON.stringify(orders));

          render();
          filter();
        });
      }

      // =============================
      // ✏️ INPUT CHANGE
      // =============================

      if (input) {
        input.addEventListener('input', (e) => {
          let val = Number(e.target.value);

          if (val > remainingQty) val = remainingQty;
          if (val < 0) val = 0;

          orders[oIdx].items[iIdx].packedQty = val;

          // Save state
          localStorage.setItem('orders', JSON.stringify(orders));

          const currentOrder = oIdx;
          const currentItem = iIdx;

          render();
          filter();

          // Restore focus
          const cards = document.querySelectorAll('.order-card');
          const targetCard = cards[currentOrder];

          if (targetCard) {
            const inputs = targetCard.querySelectorAll('.qty-input');
            const targetInput = inputs[currentItem];

            if (targetInput) {
              targetInput.focus();
              targetInput.select();
            }
          }
        });
      }

      card.appendChild(row);
    });

    orderList.appendChild(card);
  });
}

// =============================
// 📥 EXPORT REPORT
// =============================

function exportData() {
  if (!orders.length) return alert('No data');

  const final = [];

  orders.forEach((o) => {
    o.items.forEach((i) => {
      const remainingQty = i.qty - (i.fulfilledQty || 0);

      let status =
        remainingQty === 0
          ? 'Already Fulfilled'
          : i.packedQty === remainingQty
            ? 'Packed'
            : i.packedQty > 0
              ? 'Partial'
              : 'Pending';

      final.push({
        Order: o.id,
        Customer: o.customer,
        Item: i.name,
        Vendor: i.vendor,
        Fulfillment: i.fulfillmentStatus,
        Ordered: i.qty,
        Packed: i.packedQty,
        Missing: remainingQty - i.packedQty,
        Status: status,
      });
    });
  });

  const ws = XLSX.utils.json_to_sheet(final);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Report');

  XLSX.writeFile(wb, `Packing_Report.xlsx`);
}

// =============================
// 🧹 CLEAR ALL DATA
// =============================

function clearAll() {
  if (confirm('Clear all orders?')) {
    orders = [];
    localStorage.removeItem('orders');
    render();
  }
}

// =============================
// 🔍 SEARCH FILTER
// =============================

function filter() {
  const q = searchInput.value.toLowerCase();

  document.querySelectorAll('.order-card').forEach((c) => {
    c.style.display = c.innerText.toLowerCase().includes(q) ? 'block' : 'none';
  });
}

// =============================
// 💬 CHAT TOGGLE (OPTIONAL)
// =============================

function toggleChat() {
  const f = document.getElementById('chat-frame');
  f.style.display = f.style.display === 'block' ? 'none' : 'block';
}

// =============================
// 🚀 INITIAL LOAD
// =============================

if (orders.length) {
  render();
}
