function idCardPhysics() {
  return {
    isDragging: false,
    position: { x: 0, y: 0 },
    velocity: { x: 0, y: 0 },
    startPos: { x: 0, y: 0 },
    animationFrame: null,
    stiffness: 0.08,
    damping: 0.8,
    lanyardPath: "",
    anchorPoint: { x: 140, y: -20 },
    cardAttachPoint: { x: 140, y: 0 },
    hasAnimatedIn: false,
    get rotation() {
      return this.position.x * 0.1;
    },
    init() {
      window.addEventListener("mousemove", this.drag.bind(this));
      window.addEventListener("touchmove", this.drag.bind(this), { passive: false });
      window.addEventListener("mouseup", this.endDrag.bind(this));
      window.addEventListener("touchend", this.endDrag.bind(this));
      this.animate();
      this.observeSection();
    },
    observeSection() {
      const aboutSection = document.querySelector("#about");
      if (!aboutSection) {
        return;
      }
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting && !this.hasAnimatedIn) {
              this.$refs.idCard.classList.add("is-visible");
              this.hasAnimatedIn = true;
              observer.unobserve(aboutSection);
            }
          });
        },
        { threshold: 0.4 }
      );
      observer.observe(aboutSection);
    },
    startDrag(event) {
      this.isDragging = true;
      this.$refs.idCard.style.transition = "none";
      this.startPos.x = (event.clientX || event.touches[0].clientX) - this.position.x;
      this.startPos.y = (event.clientY || event.touches[0].clientY) - this.position.y;
    },
    drag(event) {
      if (!this.isDragging) return;
      event.preventDefault();
      const currentX = event.clientX || event.touches[0].clientX;
      const currentY = event.clientY || event.touches[0].clientY;
      this.position.x = currentX - this.startPos.x;
      this.position.y = currentY - this.startPos.y;
    },
    endDrag() {
      if (!this.isDragging) return;
      this.isDragging = false;
      this.$refs.idCard.style.transition = "";
    },
    animate() {
      if (!this.isDragging) {
        const forceX = -this.stiffness * this.position.x;
        const forceY = -this.stiffness * this.position.y;
        this.velocity.x = (this.velocity.x + forceX) * this.damping;
        this.velocity.y = (this.velocity.y + forceY) * this.damping;
        this.position.x += this.velocity.x;
        this.position.y += this.velocity.y;
      }
      this.updateLanyard();
      this.animationFrame = requestAnimationFrame(this.animate.bind(this));
    },
    updateLanyard() {
      const endPoint = { x: this.cardAttachPoint.x + this.position.x, y: this.cardAttachPoint.y + this.position.y };
      this.lanyardPath = `M ${this.anchorPoint.x} ${this.anchorPoint.y} Q ${this.anchorPoint.x} ${this.anchorPoint.y + 50}, ${endPoint.x} ${endPoint.y}`;
    },
  };
}

function portfolioApp() {
  return {
    backendApiUrl: "api.php",
    allItems: [],
    isLoading: true,
    connectionError: false,
    isModalOpen: false,
    isLightboxOpen: false,
    isDeleteModalOpen: false,
    isSuccessModalOpen: false,
    isSubmitting: false,
    validationMessage: "",
    showScrollTop: false,
    newItem: { title: "", description: "", category: "Pengembangan Web", imageFiles: [], adminPassword: "" },
    lightboxItem: { imageUrls: [] },
    lightboxImageIndex: 0,
    itemToDelete: { id: null, title: "", imageUrl: null, type: "" },
    deletePassword: "",
    successMessage: "",
    selectedFileNames: [],
    searchQuery: "",
    filterCategory: "Semua",
    sortOrder: "newest",
    currentPage: 1,
    itemsPerPage: 8,
    isEditModalOpen: false,
    itemToEdit: { id: null, title: "", description: "", category: "", imageUrls: [], newImageFiles: null },
    editImagePreview: "",
    editSelectedFileName: "",
    editPassword: "",
    contactForm: { name: "", email: "", message: "" },
    contactSubmitStatus: "",
    contactMessage: "",
    isContactSubmitting: false,

    get filteredItems() {
      const decodeHTML = (html) => {
        const txt = document.createElement("textarea");
        txt.innerHTML = html;
        return txt.value;
      };

      let items = [...this.allItems];
      if (this.searchQuery) {
        items = items.filter((i) => i.title && i.title.toLowerCase().includes(this.searchQuery.toLowerCase()));
      }
      if (this.filterCategory !== "Semua") {
        items = items.filter((i) => i.category && decodeHTML(i.category) === this.filterCategory);
      }
      items.sort((a, b) => {
        if (this.sortOrder === "newest") return b.timestamp - a.timestamp;
        if (this.sortOrder === "oldest") return a.timestamp - b.timestamp;
        if (a.title && b.title) {
          return a.title.localeCompare(b.title) * (this.sortOrder === "title-asc" ? 1 : -1);
        }
        return 0;
      });
      return items;
    },

    get totalPages() {
      return Math.ceil(this.filteredItems.length / this.itemsPerPage);
    },
    get paginatedItems() {
      const start = (this.currentPage - 1) * this.itemsPerPage;
      return this.filteredItems.slice(start, start + this.itemsPerPage);
    },

    init() {
      // ===== 3. TAMBAHKAN INISIALISASI AOS DI SINI =====
      AOS.init({
        duration: 800, // Durasi animasi dalam milidetik
        once: true, // Animasi hanya berjalan sekali
      });

      this.fetchPortfolioItems();
      window.addEventListener("scroll", () => {
        this.showScrollTop = window.scrollY > 400;
      });
      this.$watch("searchQuery", () => (this.currentPage = 1));
      this.$watch("filterCategory", () => (this.currentPage = 1));
      this.$watch("sortOrder", () => (this.currentPage = 1));
      // emailjs.init({ publicKey: "YOUR_PUBLIC_KEY" });
    },

    async fetchPortfolioItems() {
      this.isLoading = true;
      this.connectionError = false;
      try {
        const response = await fetch(`${this.backendApiUrl}?action=get_items`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const result = await response.json();
        this.allItems = Array.isArray(result) ? result : [];
      } catch (error) {
        console.error("Error fetching portfolio items:", error);
        this.connectionError = true;
        this.allItems = [];
      } finally {
        this.isLoading = false;
      }
    },

    nextPage() {
      if (this.currentPage < this.totalPages) this.currentPage++;
    },
    prevPage() {
      if (this.currentPage > 1) this.currentPage--;
    },

    openLightbox(item) {
      this.lightboxItem = item;
      this.lightboxImageIndex = 0;
      this.isLightboxOpen = true;
    },
    closeLightbox() {
      this.isLightboxOpen = false;
    },
    nextImage() {
      if (!this.lightboxItem.imageUrls || this.lightboxItem.imageUrls.length === 0) return;
      this.lightboxImageIndex = (this.lightboxImageIndex + 1) % this.lightboxItem.imageUrls.length;
    },
    prevImage() {
      if (!this.lightboxItem.imageUrls || this.lightboxItem.imageUrls.length === 0) return;
      this.lightboxImageIndex = (this.lightboxImageIndex - 1 + this.lightboxItem.imageUrls.length) % this.lightboxItem.imageUrls.length;
    },

    openDeleteItemModal(id, title) {
      this.itemToDelete = { id, title, type: "item" };
      this.isDeleteModalOpen = true;
      this.validationMessage = "";
    },
    openDeleteImageModal() {
      if (!this.lightboxItem.imageUrls || this.lightboxItem.imageUrls.length === 0) return;
      this.itemToDelete = { id: this.lightboxItem.id, imageUrl: this.lightboxItem.imageUrls[this.lightboxImageIndex], type: "image" };
      this.isDeleteModalOpen = true;
      this.validationMessage = "";
    },
    closeDeleteModal() {
      this.isDeleteModalOpen = false;
      this.deletePassword = "";
      this.validationMessage = "";
    },

    openEditModal(item) {
      const decodeHTML = (html) => {
        const txt = document.createElement("textarea");
        txt.innerHTML = html;
        return txt.value;
      };
      this.itemToEdit = { ...item, category: decodeHTML(item.category), newImageFiles: null };

      this.editImagePreview = item.imageUrls && item.imageUrls.length > 0 ? item.imageUrls[0] : "https://placehold.co/400x250/e8e8e8/adadad?text=Tidak+Ada+Gambar";
      this.editSelectedFileName = "";
      this.validationMessage = "";
      this.editPassword = "";
      this.isEditModalOpen = true;
    },
    closeEditModal() {
      this.isEditModalOpen = false;
      this.itemToEdit = { id: null, title: "", description: "", category: "", newImageFiles: null };
    },

    handleEditFileSelect(event) {
      const files = event.target.files;
      if (files.length > 0) {
        this.itemToEdit.newImageFiles = files;
        this.editSelectedFileName = `${files.length} file dipilih`;
        const reader = new FileReader();
        reader.onload = (e) => {
          this.editImagePreview = e.target.result;
        };
        reader.readAsDataURL(files[0]);
      }
    },

    async performDelete(action, formData, successMessage) {
      if (!this.deletePassword) {
        this.validationMessage = "Kata sandi wajib diisi.";
        return;
      }
      this.isSubmitting = true;
      this.validationMessage = "";
      formData.append("admin_password", this.deletePassword);
      try {
        const response = await fetch(`${this.backendApiUrl}?action=${action}`, { method: "POST", body: formData });
        const result = await response.json();
        if (!result.success) throw new Error(result.message || "Terjadi kesalahan");
        this.successMessage = successMessage;
        this.isSuccessModalOpen = true;
        this.closeDeleteModal();
        if (this.isLightboxOpen) this.closeLightbox();
        await this.fetchPortfolioItems();
      } catch (error) {
        this.validationMessage = `Gagal: ${error.message}`;
      } finally {
        this.isSubmitting = false;
      }
    },

    async handleDeleteItem() {
      const formData = new FormData();
      formData.append("item_id", this.itemToDelete.id);
      await this.performDelete("delete_item", formData, `Item "${this.itemToDelete.title}" berhasil dihapus!`);
    },
    async handleDeleteImage() {
      const formData = new FormData();
      formData.append("item_id", this.itemToDelete.id);
      formData.append("image_url", this.itemToDelete.imageUrl);
      await this.performDelete("delete_image", formData, "Foto berhasil dihapus!");
    },

    handleFileSelect(event) {
      this.newItem.imageFiles = event.target.files;
      this.selectedFileNames = Array.from(event.target.files).map((file) => file.name);
    },

    async handleAddItem() {
      if (!this.newItem.title || !this.newItem.description || this.newItem.imageFiles.length === 0 || !this.newItem.adminPassword) {
        this.validationMessage = "Semua field wajib diisi, termasuk gambar.";
        return;
      }
      this.isSubmitting = true;
      this.validationMessage = "";
      const formData = new FormData();
      formData.append("title", this.newItem.title);
      formData.append("description", this.newItem.description);
      formData.append("category", this.newItem.category);
      formData.append("admin_password", this.newItem.adminPassword);
      for (let i = 0; i < this.newItem.imageFiles.length; i++) {
        formData.append("images[]", this.newItem.imageFiles[i]);
      }
      try {
        const response = await fetch(`${this.backendApiUrl}?action=add_item`, { method: "POST", body: formData });
        const result = await response.json();
        if (!result.success) throw new Error(result.message);
        this.isModalOpen = false;
        this.resetNewItemForm();
        this.successMessage = "Item baru berhasil ditambahkan!";
        this.isSuccessModalOpen = true;
        await this.fetchPortfolioItems();
      } catch (error) {
        this.validationMessage = `Gagal: ${error.message}`;
      } finally {
        this.isSubmitting = false;
      }
    },

    async handleUpdateItem() {
      if (!this.itemToEdit.title || !this.itemToEdit.description || !this.editPassword) {
        this.validationMessage = "Judul, deskripsi, dan kata sandi wajib diisi.";
        return;
      }
      this.isSubmitting = true;
      this.validationMessage = "";
      const formData = new FormData();
      formData.append("item_id", this.itemToEdit.id);
      formData.append("title", this.itemToEdit.title);
      formData.append("description", this.itemToEdit.description);
      formData.append("category", this.itemToEdit.category);
      formData.append("admin_password", this.editPassword);
      if (this.itemToEdit.newImageFiles) {
        for (let i = 0; i < this.itemToEdit.newImageFiles.length; i++) {
          formData.append("images[]", this.itemToEdit.newImageFiles[i]);
        }
      }
      try {
        const response = await fetch(`${this.backendApiUrl}?action=update_item`, { method: "POST", body: formData });
        const result = await response.json();
        if (!result.success) throw new Error(result.message);
        this.closeEditModal();
        this.successMessage = "Item berhasil diperbarui!";
        this.isSuccessModalOpen = true;
        await this.fetchPortfolioItems();
      } catch (error) {
        this.validationMessage = `Gagal: ${error.message}`;
      } finally {
        this.isSubmitting = false;
      }
    },

    resetNewItemForm() {
      this.newItem = { title: "", description: "", category: "Pengembangan Web", imageFiles: [], adminPassword: "" };
      this.selectedFileNames = [];
      const fileInput = document.getElementById("file-upload");
      if (fileInput) fileInput.value = "";
    },

    closeSuccessModal() {
      this.isSuccessModalOpen = false;
      this.successMessage = "";
    },

    async handleContactSubmit() {
      if (!this.contactForm.name || !this.contactForm.email || !this.contactForm.message) {
        this.contactMessage = "Semua kolom wajib diisi.";
        this.contactSubmitStatus = "error";
        return;
      }
      this.isContactSubmitting = true;
      this.contactMessage = "";
      this.contactSubmitStatus = "";
      const templateParams = { name: this.contactForm.name, email: this.contactForm.email, message: this.contactForm.message };
      try {
        await emailjs.send("service_2mt0gvo", "template_1whkkvm", templateParams);
        this.successMessage = "Pesan Anda berhasil terkirim! Terima kasih.";
        this.isSuccessModalOpen = true;
        this.contactForm = { name: "", email: "", message: "" };
      } catch (error) {
        this.contactSubmitStatus = "error";
        this.contactMessage = `Gagal mengirim pesan: ${error.text || "Error tidak diketahui"}`;
      } finally {
        this.isContactSubmitting = false;
      }
    },
  };
}
