
"use strict";

// SnapJournal 
// Local-first photo journal using IndexedDB. No server or login required.

const DB_NAME = "SnapJournalDB";
const DB_VERSION = 1;
const STORE_NAME = "memories";

const $ = (id) => document.getElementById(id);

const elements = {
  cameraPreview: $("cameraPreview"),
  photoPreview: $("photoPreview"),
  cameraPlaceholder: $("cameraPlaceholder"),
  photoCanvas: $("photoCanvas"),
  startCameraBtn: $("startCameraBtn"),
  captureBtn: $("captureBtn"),
  photoInput: $("photoInput"),
  cameraMessage: $("cameraMessage"),
  journalForm: $("journalForm"),
  photoTitle: $("photoTitle"),
  photoNote: $("photoNote"),
  savePhotoBtn: $("savePhotoBtn"),
  photoCount: $("photoCount"),
  emptyGallery: $("emptyGallery"),
  galleryMessage: $("galleryMessage"),
  photoGallery: $("photoGallery"),
  photoDialog: $("photoDialog"),
  dialogImage: $("dialogImage"),
  dialogTitle: $("dialogTitle"),
  dialogNote: $("dialogNote"),
  dialogDate: $("dialogDate"),
  closeDialogBtn: $("closeDialogBtn"),
  sharePhotoBtn: $("sharePhotoBtn"),
  deletePhotoBtn: $("deletePhotoBtn")
};

let db;
let cameraStream = null;
let selectedImageBlob = null;
let selectedMemoryId = null;
let previewObjectUrl = null;
let dialogObjectUrl = null;
const galleryObjectUrls = new Set();

// IndexedDB 

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("Trình duyệt không hỗ trợ IndexedDB."));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const database = event.target.result;

      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, {
          keyPath: "id",
          autoIncrement: true
        });

        store.createIndex("createdAt", "createdAt", {
          unique: false
        });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      reject(request.error || new Error("Không thể mở cơ sở dữ liệu."));
    };

    request.onblocked = () => {
      reject(new Error("Cơ sở dữ liệu đang bị chặn bởi tab khác."));
    };
  });
}

function getStore(mode = "readonly") {
  const transaction = db.transaction(STORE_NAME, mode);
  return transaction.objectStore(STORE_NAME);
}

function addMemory(memory) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const request = transaction.objectStore(STORE_NAME).add(memory);
    let memoryId;

    request.onsuccess = () => {
      memoryId = request.result;
    };
    request.onerror = () => {
      reject(request.error || new Error("Không thể lưu ảnh."));
    };
    transaction.oncomplete = () => resolve(memoryId);
    transaction.onabort = () => {
      reject(transaction.error || new Error("Lưu ảnh thất bại."));
    };
  });
}

function getAllMemories() {
  return new Promise((resolve, reject) => {
    const request = getStore().getAll();

    request.onsuccess = () => {
      const memories = request.result || [];
      memories.sort((a, b) => b.createdAt - a.createdAt);
      resolve(memories);
    };

    request.onerror = () => {
      reject(request.error || new Error("Không thể tải thư viện ảnh."));
    };
  });
}

function getMemory(id) {
  return new Promise((resolve, reject) => {
    const request = getStore().get(id);

    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => {
      reject(request.error || new Error("Không thể mở ảnh."));
    };
  });
}

function deleteMemory(id) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const request = transaction.objectStore(STORE_NAME).delete(id);

    request.onerror = () => {
      reject(request.error || new Error("Không thể xóa ảnh."));
    };
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => {
      reject(transaction.error || new Error("Xóa ảnh thất bại."));
    };
  });
}

// Camera and image selection 

function showMessage(element, message, isError = false) {
  element.textContent = message;
  element.style.color = isError ? "#b84c43" : "";
}

function releasePreviewUrl() {
  if (previewObjectUrl) {
    URL.revokeObjectURL(previewObjectUrl);
    previewObjectUrl = null;
  }
}

function releaseDialogUrl() {
  if (dialogObjectUrl) {
    URL.revokeObjectURL(dialogObjectUrl);
    dialogObjectUrl = null;
  }
}

function releaseGalleryUrls() {
  for (const url of galleryObjectUrls) {
    URL.revokeObjectURL(url);
  }
  galleryObjectUrls.clear();
}

function stopCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach((track) => track.stop());
    cameraStream = null;
  }

  elements.cameraPreview.srcObject = null;
  elements.cameraPreview.hidden = true;
  elements.captureBtn.disabled = true;
  elements.startCameraBtn.textContent = "◎ Mở camera";
}

function updatePreview(blob) {
  releasePreviewUrl();

  selectedImageBlob = blob;
  previewObjectUrl = URL.createObjectURL(blob);

  elements.photoPreview.src = previewObjectUrl;
  elements.photoPreview.hidden = false;
  elements.cameraPlaceholder.hidden = true;
  elements.cameraPreview.hidden = true;
  elements.savePhotoBtn.disabled = false;

  showMessage(elements.cameraMessage, "Ảnh đã sẵn sàng để lưu.");
}

async function startCamera() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showMessage(
      elements.cameraMessage,
      "Camera không khả dụng. Hãy mở ứng dụng bằng localhost hoặc HTTPS, hoặc chọn ảnh từ thiết bị.",
      true
    );
    return;
  }

  stopCamera();
  elements.startCameraBtn.disabled = true;

  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: { ideal: "environment" }
      }
    });

    elements.photoPreview.hidden = true;
    elements.cameraPlaceholder.hidden = true;
    elements.cameraPreview.hidden = false;
    elements.cameraPreview.srcObject = cameraStream;

    await elements.cameraPreview.play();

    elements.captureBtn.disabled = false;
    elements.startCameraBtn.textContent = "Tắt camera";
    showMessage(elements.cameraMessage, "Camera đã sẵn sàng.");
  } catch (error) {
    stopCamera();
    elements.photoPreview.hidden = !selectedImageBlob;
    elements.cameraPlaceholder.hidden = Boolean(selectedImageBlob);

    let message = "Không thể mở camera. Hãy kiểm tra quyền truy cập camera.";

    if (error.name === "NotAllowedError" || error.name === "SecurityError") {
      message = "Quyền camera bị từ chối. Hãy cấp quyền camera trong trình duyệt hoặc chọn ảnh từ thiết bị.";
    } else if (error.name === "NotFoundError") {
      message = "Không tìm thấy camera trên thiết bị này.";
    } else if (error.name === "NotReadableError") {
      message = "Camera đang được ứng dụng khác sử dụng.";
    }

    showMessage(elements.cameraMessage, message, true);
  } finally {
    elements.startCameraBtn.disabled = false;
  }
}

function capturePhoto() {
  const video = elements.cameraPreview;

  if (!cameraStream || !video.videoWidth || !video.videoHeight) {
    showMessage(elements.cameraMessage, "Camera chưa sẵn sàng để chụp.", true);
    return;
  }

  const canvas = elements.photoCanvas;
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  const context = canvas.getContext("2d");

  if (!context) {
    showMessage(elements.cameraMessage, "Không thể xử lý ảnh trên thiết bị này.", true);
    return;
  }

  context.drawImage(video, 0, 0, canvas.width, canvas.height);

  canvas.toBlob((blob) => {
    if (!blob) {
      showMessage(elements.cameraMessage, "Chụp ảnh thất bại. Hãy thử lại.", true);
      return;
    }

    updatePreview(blob);
    stopCamera();
  }, "image/jpeg", 0.9);
}

function handleImageSelection(event) {
  const file = event.target.files && event.target.files[0];

  if (!file) return;

  if (!file.type.startsWith("image/")) {
    showMessage(elements.cameraMessage, "Vui lòng chọn một tệp ảnh hợp lệ.", true);
    elements.photoInput.value = "";
    return;
  }

  if (file.size > 20 * 1024 * 1024) {
    showMessage(elements.cameraMessage, "Ảnh quá lớn. Hãy chọn ảnh nhỏ hơn 20 MB.", true);
    elements.photoInput.value = "";
    return;
  }

  stopCamera();
  updatePreview(file);
  elements.photoInput.value = "";
}

//  Gallery 

function formatDate(value) {
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function createGalleryCard(memory) {
  const card = document.createElement("article");
  card.className = "photo-card";

  const image = document.createElement("img");
  image.className = "photo-card-image";
  image.alt = memory.title;
  image.loading = "lazy";
  image.src = URL.createObjectURL(memory.image);
  galleryObjectUrls.add(image.src);

  card.dataset.memoryId = String(memory.id);

  const content = document.createElement("div");
  content.className = "photo-card-content";

  const title = document.createElement("h3");
  title.textContent = memory.title;

  const note = document.createElement("p");
  note.textContent = memory.note || "Một khoảnh khắc đáng nhớ.";

  const date = document.createElement("time");
  date.dateTime = new Date(memory.createdAt).toISOString();
  date.textContent = formatDate(memory.createdAt);

  const openButton = document.createElement("button");
  openButton.type = "button";
  openButton.className = "card-open";
  openButton.textContent = "Xem kỷ niệm";

  openButton.addEventListener("click", () => openMemory(memory.id));
  image.addEventListener("click", () => openMemory(memory.id));

  content.append(title, note, date, openButton);
  card.append(image, content);

  return card;
}

async function renderGallery() {
  try {
    const memories = await getAllMemories();

    releaseGalleryUrls();
    elements.photoGallery.replaceChildren();
    elements.photoCount.textContent = `${memories.length} ảnh`;
    elements.emptyGallery.hidden = memories.length > 0;

    for (const memory of memories) {
      elements.photoGallery.appendChild(createGalleryCard(memory));
    }

    showMessage(elements.galleryMessage, "");
  } catch (error) {
    console.error(error);
    showMessage(
      elements.galleryMessage,
      "Không thể tải thư viện. Hãy tải lại trang và thử lại.",
      true
    );
  }
}

async function openMemory(id) {
  try {
    const memory = await getMemory(id);

    if (!memory) {
      showMessage(elements.galleryMessage, "Không tìm thấy ảnh này.", true);
      return;
    }

    selectedMemoryId = memory.id;
    releaseDialogUrl();

    dialogObjectUrl = URL.createObjectURL(memory.image);
    elements.dialogImage.src = dialogObjectUrl;
    elements.dialogImage.alt = memory.title;
    elements.dialogTitle.textContent = memory.title;
    elements.dialogNote.textContent = memory.note || "Không có ghi chú.";
    elements.dialogDate.textContent = formatDate(memory.createdAt);

    if (typeof elements.photoDialog.showModal === "function") {
      elements.photoDialog.showModal();
    } else {
      showMessage(elements.galleryMessage, "Trình duyệt không hỗ trợ cửa sổ xem ảnh.", true);
    }
  } catch (error) {
    console.error(error);
    showMessage(elements.galleryMessage, "Không thể mở ảnh.", true);
  }
}

function closePhotoDialog() {
  if (elements.photoDialog.open) {
    elements.photoDialog.close();
  }

  clearPhotoDialog();
}

function clearPhotoDialog() {
  elements.dialogImage.removeAttribute("src");
  releaseDialogUrl();
  selectedMemoryId = null;
}

//  Save, delete and share 

async function saveCurrentMemory(event) {
  event.preventDefault();

  if (!selectedImageBlob) {
    showMessage(elements.cameraMessage, "Hãy chụp hoặc chọn ảnh trước khi lưu.", true);
    return;
  }

  const title = elements.photoTitle.value.trim();
  const note = elements.photoNote.value.trim();

  if (!title) {
    elements.photoTitle.focus();
    showMessage(elements.cameraMessage, "Vui lòng nhập tiêu đề cho ảnh.", true);
    return;
  }

  elements.savePhotoBtn.disabled = true;
  elements.savePhotoBtn.textContent = "Đang lưu...";

  try {
    await addMemory({
      title,
      note,
      image: selectedImageBlob,
      createdAt: Date.now()
    });

    elements.journalForm.reset();
    selectedImageBlob = null;
    elements.photoPreview.removeAttribute("src");
    elements.photoPreview.hidden = true;
    elements.cameraPlaceholder.hidden = false;
    releasePreviewUrl();

    showMessage(elements.cameraMessage, "Đã lưu kỷ niệm trên thiết bị.");
    await renderGallery();
  } catch (error) {
    console.error(error);
    showMessage(
      elements.cameraMessage,
      "Lưu ảnh thất bại. Có thể thiết bị đã hết dung lượng hoặc trình duyệt chặn lưu trữ.",
      true
    );
  } finally {
    elements.savePhotoBtn.disabled = !selectedImageBlob;
    elements.savePhotoBtn.textContent = "Lưu vào nhật ký";
  }
}

async function removeCurrentMemory() {
  if (selectedMemoryId === null) return;

  const confirmed = window.confirm("Muội có chắc muốn xóa kỷ niệm này? Không thể hoàn tác.");
  if (!confirmed) return;

  try {
    await deleteMemory(selectedMemoryId);
    closePhotoDialog();
    await renderGallery();
    showMessage(elements.galleryMessage, "Đã xóa kỷ niệm.");
  } catch (error) {
    console.error(error);
    showMessage(elements.galleryMessage, "Xóa ảnh thất bại. Hãy thử lại.", true);
  }
}

async function shareCurrentMemory() {
  if (selectedMemoryId === null) return;

  try {
    const memory = await getMemory(selectedMemoryId);
    if (!memory) throw new Error("Không tìm thấy ảnh.");

    const extensionByType = {
      "image/gif": "gif",
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp"
    };
    const extension = extensionByType[memory.image.type] || "jpg";
    const fileType = memory.image.type || "image/jpeg";
    const file = new File(
      [memory.image],
      `snapjournal-${memory.id}.${extension}`,
      { type: fileType }
    );

    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        title: memory.title,
        text: memory.note || "Một kỷ niệm từ SnapJournal",
        files: [file]
      });
    } else if (navigator.share) {
      await navigator.share({
        title: memory.title,
        text: `${memory.title}\n${memory.note || ""}`
      });

      showMessage(elements.galleryMessage, "Trình duyệt chỉ hỗ trợ chia sẻ nội dung văn bản ở đây.");
    } else {
      // Fallback: download the image so the user can share it manually.
      const url = URL.createObjectURL(memory.image);
      const link = document.createElement("a");
      link.href = url;
      link.download = file.name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);

      showMessage(elements.galleryMessage, "Đã tải ảnh xuống. Muội có thể chia sẻ ảnh từ thư mục tải xuống.");
    }
  } catch (error) {
    if (error.name === "AbortError") return;

    console.error(error);
    showMessage(elements.galleryMessage, "Chia sẻ chưa thành công. Hãy thử tải ảnh xuống để chia sẻ thủ công.", true);
  }
}

//  Events and initialization 

elements.startCameraBtn.addEventListener("click", () => {
  if (cameraStream) {
    stopCamera();
    elements.cameraPlaceholder.hidden = false;
    showMessage(elements.cameraMessage, "Đã tắt camera.");
  } else {
    startCamera();
  }
});

elements.captureBtn.addEventListener("click", capturePhoto);
elements.photoInput.addEventListener("change", handleImageSelection);
elements.journalForm.addEventListener("submit", saveCurrentMemory);
elements.closeDialogBtn.addEventListener("click", closePhotoDialog);
elements.deletePhotoBtn.addEventListener("click", removeCurrentMemory);
elements.sharePhotoBtn.addEventListener("click", shareCurrentMemory);

elements.photoDialog.addEventListener("click", (event) => {
  if (event.target === elements.photoDialog) {
    closePhotoDialog();
  }
});

elements.photoDialog.addEventListener("close", clearPhotoDialog);

window.addEventListener("pagehide", () => {
  stopCamera();
  releasePreviewUrl();
  releaseDialogUrl();
  releaseGalleryUrls();
});

async function initializeApp() {
  try {
    db = await openDatabase();
    await renderGallery();
  } catch (error) {
    console.error(error);
    showMessage(
      elements.galleryMessage,
      "Không thể khởi tạo lưu trữ trên thiết bị. Hãy mở ứng dụng qua localhost hoặc HTTPS và kiểm tra cài đặt trình duyệt.",
      true
    );
    elements.savePhotoBtn.disabled = true;
  }

  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    navigator.serviceWorker.register("service-worker.js").catch((error) => {
      console.warn("Service Worker registration failed:", error);
    });
  }
}

initializeApp();
