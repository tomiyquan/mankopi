import Swal from "sweetalert2";

const Toast = Swal.mixin({
  toast: true,
  position: "top-end",
  showConfirmButton: false,
  timer: 3400,
  timerProgressBar: true,
  showClass: { popup: "mk-toast-in" },
  hideClass: { popup: "mk-toast-out" },
  customClass: {
    popup: "mk-toast",
    title: "mk-toast-title",
    htmlContainer: "mk-toast-text",
    timerProgressBar: "mk-toast-bar",
  },
  didOpen: (popup) => {
    popup.addEventListener("mouseenter", Swal.stopTimer);
    popup.addEventListener("mouseleave", Swal.resumeTimer);
  },
});

function messageOf(error: unknown, fallback = "Terjadi kesalahan") {
  return error instanceof Error && error.message ? error.message : fallback;
}

export const notify = {
  success(title: string, text?: string) {
    return Toast.fire({ icon: "success", title, text });
  },
  error(title: string, text?: string) {
    return Toast.fire({ icon: "error", title, text, timer: 5200 });
  },
  info(title: string, text?: string) {
    return Toast.fire({ icon: "info", title, text });
  },
  warning(title: string, text?: string) {
    return Toast.fire({ icon: "warning", title, text });
  },
  fail(error: unknown, title = "Aksi gagal") {
    return this.error(title, messageOf(error));
  },
};

export async function confirmAction(input: {
  title: string;
  text: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}): Promise<boolean> {
  const result = await Swal.fire({
    title: input.title,
    text: input.text,
    icon: input.danger ? "warning" : "question",
    showCancelButton: true,
    reverseButtons: true,
    focusCancel: true,
    confirmButtonText: input.confirmText ?? "Ya, lanjut",
    cancelButtonText: input.cancelText ?? "Batal",
    buttonsStyling: false,
    showClass: { popup: "mk-swal-in" },
    hideClass: { popup: "mk-swal-out" },
    customClass: {
      popup: "mk-swal",
      title: "mk-swal-title",
      htmlContainer: "mk-swal-text",
      actions: "mk-swal-actions",
      confirmButton: input.danger ? "mk-swal-danger" : "mk-swal-confirm",
      cancelButton: "mk-swal-cancel",
      icon: "mk-swal-icon",
    },
  });
  return result.isConfirmed;
}

export function noticeHandlers<TData, TVars>(opts: {
  success: string | ((data: TData, vars: TVars) => string);
  onSuccess?: (data: TData, vars: TVars) => void;
}) {
  return {
    onSuccess: (data: TData, vars: TVars) => {
      const title = typeof opts.success === "function" ? opts.success(data, vars) : opts.success;
      void notify.success(title);
      opts.onSuccess?.(data, vars);
    },
    onError: (error: unknown) => {
      void notify.fail(error);
    },
  };
}
