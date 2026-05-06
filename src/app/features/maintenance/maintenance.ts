import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { MaintenanceStatus, MaintenanceRequest, CreateMaintenanceDto, UpdateMaintenanceDto, MaintenanceService } from '../../service/Maintenance-service';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Chalet, ChaletService } from '../../service/chalet-service';

@Component({
  selector: 'app-maintenance',
  imports: [CommonModule, FormsModule, HttpClientModule],
  templateUrl: './maintenance.html',
  styleUrl: './maintenance.css',
})
export class Maintenance implements OnInit {
  MaintenanceStatus = MaintenanceStatus;

  requests: MaintenanceRequest[] = [];
  filteredRequests: MaintenanceRequest[] = [];
  chalets: Chalet[] = [];
  chaletsLoading = false;

  isLoading = false;
  isSubmitting = false; // ← guard ضد double submit
  errorMessage = '';

  // Filters
  searchText = '';
  selectedStatus = 'all';

  // Stats
  get totalCount() { return this.requests.length; }
  get openCount() { return this.requests.filter(r => r.status === 'Open').length; }
  get inProgressCount() { return this.requests.filter(r => r.status === 'InProgress').length; }
  get closedCount() { return this.requests.filter(r => r.status === 'Closed').length; }

  // Modal state
  showAddModal = false;
  showEditModal = false;
  showDeleteConfirm = false;
  selectedRequest: MaintenanceRequest | null = null;

  // Forms
  newRequest: CreateMaintenanceDto = { chaletId: 0, description: '' };
  editForm: UpdateMaintenanceDto = { description: '', status: MaintenanceStatus.Open };

  statusOptions = [
    { label: 'مفتوح', value: MaintenanceStatus.Open },
    { label: 'قيد التنفيذ', value: MaintenanceStatus.InProgress },
    { label: 'مغلق', value: MaintenanceStatus.Closed },
  ];

  constructor(
    private maintenanceService: MaintenanceService,
    private chaletService: ChaletService
    , private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.loadRequests();
    this.loadChalets();
  }

  loadChalets(): void {
    this.chaletsLoading = true;
    this.chaletService.getAll().subscribe({
      next: (data) => {
        this.chalets = data;
        this.chaletsLoading = false;
        this.cdr.detectChanges(); // 🔥 مهم

      },
      error: () => {
        this.cdr.detectChanges(); // 🔥 مهم
        // Demo chalets fallback
        this.chalets = [
          { id: 1, name: 'كوخ 1', type: 'Normal', status: 'Available', images: [] },
          { id: 2, name: 'كوخ 2', type: 'Normal', status: 'Booked', images: [] },
          { id: 3, name: 'كوخ 3', type: 'Royal', status: 'Available', images: [] },
          { id: 4, name: 'كوخ 4', type: 'Normal', status: 'Maintenance', images: [] },
          { id: 5, name: 'كوخ 5', type: 'Royal', status: 'Available', images: [] },
        ];
        this.chaletsLoading = false;
      }
    });
  }

  loadRequests(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.maintenanceService.getAll().subscribe({
      next: (data) => {
        this.requests = data;
        this.applyFilters();
        this.isLoading = false;
        this.cdr.detectChanges(); // 🔥 مهم

      },
      error: () => {
        this.errorMessage = 'حدث خطأ أثناء تحميل البيانات';
        this.isLoading = false;
        // Demo data for display
        this.requests = [
          { id: 1, chaletId: 9, chaletName: 'كوخ 8', description: 'يتم صيانة التكييف', status: 'Open', createdAt: '04-22-2026' },
          { id: 2, chaletId: 3, chaletName: 'كوخ 3', description: 'إصلاح السباكة في الحمام', status: 'InProgress', createdAt: '04-20-2026' },
          { id: 3, chaletId: 5, chaletName: 'كوخ 5', description: 'تغيير لمبات الإنارة', status: 'Closed', createdAt: '04-18-2026' },
          { id: 4, chaletId: 1, chaletName: 'كوخ 1', description: 'صيانة الشبكة الكهربائية', status: 'Open', createdAt: '04-23-2026' },
        ];
        this.applyFilters();
        this.cdr.detectChanges(); // 🔥 مهم

      }
    });
  }

  applyFilters(): void {
    let result = [...this.requests];
    if (this.searchText.trim()) {
      const q = this.searchText.toLowerCase();
      result = result.filter(r =>
        r.description?.toLowerCase().includes(q) ||
        r.chaletName?.toLowerCase().includes(q)
      );
    }
    if (this.selectedStatus !== 'all') {
      result = result.filter(r => r.status === this.selectedStatus);
    }
    this.filteredRequests = result;
  }

  onSearch(): void { this.applyFilters(); }
  onStatusFilter(): void { this.applyFilters(); }

  openAddModal(): void {
    this.newRequest = { chaletId: 0, description: '' };
    this.isSubmitting = false;
    this.showAddModal = true;
  }

  closeAddModal(): void {
    if (this.isSubmitting) return; // منع الإغلاق أثناء الحفظ
    this.showAddModal = false;
  }

  submitAdd(): void {
    if (!this.newRequest.chaletId || !this.newRequest.description) return;
    if (this.isSubmitting) return; // ← منع double submit
    this.isSubmitting = true;

    const selectedChalet = this.chalets.find(c => c.id === +this.newRequest.chaletId);

    this.maintenanceService.create(this.newRequest).subscribe({
      next: (created) => {
        // لو الـ API ما رجع chaletName نكملها من الـ chalets list
        if (!created.chaletName && selectedChalet) {
          created.chaletName = selectedChalet.name;
        }
        this.requests.unshift(created);
        this.applyFilters();
        this.isSubmitting = false;
        this.showAddModal = false;
          this.cdr.detectChanges(); // 🔥 الحل هنا

      },
      error: () => {
        const demo: MaintenanceRequest = {
          id: this.requests.length + 1,
          chaletId: this.newRequest.chaletId,
          chaletName: selectedChalet?.name ?? `كوخ ${this.newRequest.chaletId}`,
          description: this.newRequest.description,
          status: 'Open',
          createdAt: new Date().toLocaleDateString('ar-EG')
        };
        this.requests.unshift(demo);
        this.applyFilters();
        this.isSubmitting = false;
        this.showAddModal = false;
      }
    });
  }

  openEditModal(req: MaintenanceRequest): void {
    this.selectedRequest = { ...req };
    this.editForm = {
      description: req.description,
      status: this.statusStringToEnum(req.status)
    };
    this.showEditModal = true;
  }

  closeEditModal(): void { this.showEditModal = false; }

  submitEdit(): void {
    if (!this.selectedRequest?.id) return;
    this.maintenanceService.update(this.selectedRequest.id, this.editForm).subscribe({
      next: (updated) => {
        const idx = this.requests.findIndex(r => r.id === updated.id);
        if (idx > -1) this.requests[idx] = updated;
        this.applyFilters();
        this.showEditModal = false;
      },
      error: () => {
        // Demo update
        const idx = this.requests.findIndex(r => r.id === this.selectedRequest?.id);
        if (idx > -1) {
          this.requests[idx] = {
            ...this.requests[idx],
            description: this.editForm.description,
            status: MaintenanceStatus[this.editForm.status]
          };
          this.applyFilters();
        }
        this.showEditModal = false;
      }
    });
  }

  openDeleteConfirm(req: MaintenanceRequest): void {
    this.selectedRequest = req;
    this.showDeleteConfirm = true;
  }

  closeDeleteConfirm(): void { this.showDeleteConfirm = false; }

  confirmDelete(): void {
    if (!this.selectedRequest?.id) return;
    this.maintenanceService.delete(this.selectedRequest.id).subscribe({
      next: () => {
        this.requests = this.requests.filter(r => r.id !== this.selectedRequest?.id);
        this.applyFilters();
        this.showDeleteConfirm = false;
      },
      error: () => {
        this.requests = this.requests.filter(r => r.id !== this.selectedRequest?.id);
        this.applyFilters();
        this.showDeleteConfirm = false;
      }
    });
  }

  statusStringToEnum(status?: string): MaintenanceStatus {
    switch (status) {
      case 'InProgress': return MaintenanceStatus.InProgress;
      case 'Closed': return MaintenanceStatus.Closed;
      default: return MaintenanceStatus.Open;
    }
  }

  getStatusLabel(status?: string): string {
    switch (status) {
      case 'Open': return 'مفتوح';
      case 'InProgress': return 'قيد التنفيذ';
      case 'Closed': return 'مغلق';
      default: return status || '';
    }
  }

  getStatusClass(status?: string): string {
    switch (status) {
      case 'Open': return 'badge-open';
      case 'InProgress': return 'badge-inprogress';
      case 'Closed': return 'badge-closed';
      default: return '';
    }
  }

  getStatusIcon(status?: string): string {
    switch (status) {
      case 'Open': return 'bi-exclamation-circle-fill';
      case 'InProgress': return 'bi-hourglass-split';
      case 'Closed': return 'bi-check-circle-fill';
      default: return 'bi-circle';
    }
  }
}