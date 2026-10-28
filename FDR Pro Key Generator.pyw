"""Admin-only FDR Pro activation-key generator.

Keep this source file out of customer distribution builds.
"""
from __future__ import annotations

import base64
import hashlib
import json
import secrets
from datetime import datetime, timedelta
from pathlib import Path

from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey


SECRET_SALT = "FDR_MASTER_SALT_PRO_2026_@#!dramadl"
PLAN_MAP = {
    "monthly": ("1MONTH", "1 ខែ (30 ថ្ងៃ)"),
    "3months": ("3MONTHS", "3 ខែ (90 ថ្ងៃ)"),
    "yearly": ("1YEAR", "1 ឆ្នាំ (365 ថ្ងៃ)"),
    "lifetime": ("LIFETIME", "រហូត (Lifetime VIP)"),
}


def generate_key(plan_name: str, device_id: str) -> tuple[str, str]:
    plan_code, expiry = PLAN_MAP.get(plan_name, ("LIFETIME", "រហូត (Lifetime VIP)"))
    clean_id = str(device_id).strip().upper()
    payload = f"{clean_id}:{plan_code}:{SECRET_SALT}"
    sig = hashlib.sha256(payload.encode("utf-8")).hexdigest().upper()
    key = f"PRO-{sig[0:4]}-{sig[4:8]}-{sig[8:12]}-{sig[12:16]}"
    return key, expiry


def run_gui() -> None:
    import tkinter as tk
    from tkinter import messagebox, ttk

    root = tk.Tk()
    root.title("FDR Pro Key Generator")
    window_width, window_height = 760, 740
    screen_width, screen_height = root.winfo_screenwidth(), root.winfo_screenheight()
    position_x = max(0, (screen_width - window_width) // 2)
    position_y = max(0, (screen_height - window_height) // 2)
    root.geometry(f"{window_width}x{window_height}+{position_x}+{position_y}")
    root.minsize(680, 600)
    root.configure(bg="#090d12")
    root.option_add("*TCombobox*Listbox.background", "#111820")
    root.option_add("*TCombobox*Listbox.foreground", "#f5f7fa")
    root.option_add("*TCombobox*Listbox.selectBackground", "#b77b2d")
    root.option_add("*TCombobox*Listbox.selectForeground", "#ffffff")
    icon_path = Path(__file__).resolve().parent / "FDR Download Drama.ico"
    if icon_path.is_file():
        try:
            root.iconbitmap(str(icon_path))
        except tk.TclError:
            pass

    style = ttk.Style(root)
    style.theme_use("clam")
    style.configure(
        "FDR.TCombobox", fieldbackground="#111820", background="#182129",
        foreground="#f5f7fa", arrowcolor="#e6a23c", bordercolor="#3d4a54",
        lightcolor="#3d4a54", darkcolor="#3d4a54", padding=8,
    )
    style.map(
        "FDR.TCombobox",
        fieldbackground=[("readonly", "#111820")],
        foreground=[("readonly", "#f5f7fa")],
        selectbackground=[("readonly", "#111820")],
        selectforeground=[("readonly", "#f5f7fa")],
    )
    style.configure(
        "FDR.TSpinbox", fieldbackground="#111820", background="#182129",
        foreground="#f5f7fa", arrowcolor="#e6a23c", bordercolor="#3d4a54",
        lightcolor="#3d4a54", darkcolor="#3d4a54", padding=8,
    )

    shell = tk.Frame(root, bg="#090d12", padx=28, pady=24)
    shell.pack(fill="both", expand=True)
    tk.Label(shell, text="FDR PRO", bg="#090d12", fg="#e6a23c", font=("Segoe UI", 11, "bold")).pack(anchor="w")
    tk.Label(shell, text="Key Generator", bg="#090d12", fg="#ffffff", font=("Segoe UI", 24, "bold")).pack(anchor="w", pady=(2, 3))
    tk.Label(shell, text="Create a secure, device-bound activation key in three simple steps.", bg="#090d12", fg="#8f9ba4", font=("Segoe UI", 10)).pack(anchor="w", pady=(0, 20))

    controls = tk.Frame(shell, bg="#111820", highlightbackground="#2d3942", highlightthickness=1, padx=18, pady=16)
    controls.pack(fill="x")
    tk.Label(controls, text="STEP 1  •  SELECT PLAN", bg="#111820", fg="#e6a23c", font=("Segoe UI", 8, "bold")).grid(row=0, column=0, sticky="w")
    tk.Label(controls, text="NUMBER OF KEYS", bg="#111820", fg="#89969f", font=("Segoe UI", 8, "bold")).grid(row=0, column=1, sticky="w", padx=(14, 0))

    plan_labels = {
        "Monthly — $9.99": "monthly",
        "3 Months — $23.99": "3months",
        "Yearly — $55.00": "yearly",
        "Lifetime — $130": "lifetime",
    }
    plan_var = tk.StringVar(value="Yearly — $55.00")
    plan_box = ttk.Combobox(controls, textvariable=plan_var, values=list(plan_labels), state="readonly", width=28, style="FDR.TCombobox")
    plan_box.grid(row=1, column=0, sticky="ew", pady=(6, 0))
    count_var = tk.IntVar(value=1)
    count_box = ttk.Spinbox(controls, from_=1, to=100, textvariable=count_var, width=12, style="FDR.TSpinbox")
    count_box.grid(row=1, column=1, sticky="ew", padx=(14, 0), pady=(6, 0))
    controls.columnconfigure(0, weight=1)

    tk.Label(controls, text="STEP 2  •  CUSTOMER DEVICE ID", bg="#111820", fg="#e6a23c", font=("Segoe UI", 8, "bold")).grid(row=2, column=0, columnspan=2, sticky="w", pady=(16, 0))
    device_row = tk.Frame(controls, bg="#111820")
    device_row.grid(row=3, column=0, columnspan=2, sticky="ew", pady=(6, 0))
    device_row.columnconfigure(0, weight=1)
    device_var = tk.StringVar()
    device_entry = tk.Entry(device_row, textvariable=device_var, bg="#0c1319", fg="#f5f7fa", insertbackground="#ffffff", relief="flat", highlightbackground="#3d4a54", highlightcolor="#d69c43", highlightthickness=1, font=("Consolas", 10))
    device_entry.grid(row=0, column=0, sticky="ew", ipady=9)

    def paste_device() -> None:
        try:
            value = root.clipboard_get().strip().upper()
        except tk.TclError:
            value = ""
        device_var.set(value)
        device_entry.icursor("end")
        device_entry.focus_set()

    paste_button = tk.Button(device_row, text="Paste", command=paste_device, bg="#26323a", fg="#ffffff", activebackground="#35434d", activeforeground="#ffffff", relief="flat", padx=14, pady=8, cursor="hand2", font=("Segoe UI", 8, "bold"))
    paste_button.grid(row=0, column=1, padx=(8, 0))

    def change_device() -> None:
        device_var.set("")
        result.delete("1.0", "end")
        status_var.set("Paste the new customer's Device ID.")
        device_entry.focus_set()

    change_button = tk.Button(device_row, text="Reset / Change", command=change_device, bg="#172027", fg="#cbd3d8", activebackground="#26323a", activeforeground="#ffffff", relief="flat", padx=12, pady=8, cursor="hand2", font=("Segoe UI", 8, "bold"))
    change_button.grid(row=0, column=2, padx=(8, 0))

    tk.Label(shell, text="STEP 3  •  GENERATED ACTIVATION KEY", bg="#090d12", fg="#e6a23c", font=("Segoe UI", 8, "bold")).pack(anchor="w", pady=(16, 0))
    result = tk.Text(shell, height=9, bg="#0c1217", fg="#f2c879", insertbackground="#ffffff", relief="flat", padx=14, pady=12, font=("Consolas", 10), wrap="char")
    result.pack(fill="both", expand=True, pady=(7, 12))

    status_var = tk.StringVar(value="Ready — choose a plan and paste the customer's Device ID.")
    generated_state: dict[str, object] = {}
    tk.Label(shell, textvariable=status_var, bg="#090d12", fg="#8f9ba4", font=("Segoe UI", 9)).pack(anchor="w", pady=(0, 9))
    actions = tk.Frame(shell, bg="#090d12")
    actions.pack(fill="x")

    def generate() -> None:
        try:
            count = int(count_var.get())
        except (ValueError, tk.TclError):
            count = 0
        if not 1 <= count <= 100:
            messagebox.showwarning("Invalid count", "Enter a number between 1 and 100.", parent=root)
            return
        device_id = device_var.get().strip().upper()
        if not device_id.startswith("FDR-"):
            messagebox.showwarning(
                "Device ID required",
                "Paste the Device ID sent by the customer.\nExpected format: FDR-XXXX-XXXX-XXXX",
                parent=root,
            )
            device_entry.focus_set()
            return
        plan = plan_labels[plan_var.get()]
        lines = []
        keys = []
        for _ in range(count):
            key, expiry = generate_key(plan, device_id)
            keys.append(key)
            lines.append(f"{key}\nDevice: {device_id}\nExpires: {expiry}")
        generated_state.update(keys=keys, plan=plan_var.get(), device=device_id, expiry=expiry)
        result.delete("1.0", "end")
        result.insert("1.0", "\n\n".join(lines))
        result.tag_add("all", "1.0", "end")
        result.tag_configure("all", spacing1=2, spacing3=2)
        status_var.set(f"✓ Generated {count} {plan} key(s) successfully.")

    def copy_key() -> None:
        keys = generated_state.get("keys") or []
        if not keys:
            messagebox.showinfo("Nothing to copy", "Generate at least one key first.", parent=root)
            return
        root.clipboard_clear()
        root.clipboard_append("\n".join(keys))
        root.update()
        status_var.set("✓ Activation key copied to the clipboard.")

    def copy_customer_message() -> None:
        keys = generated_state.get("keys") or []
        if not keys:
            messagebox.showinfo("Nothing to copy", "Generate a key first.", parent=root)
            return
        message = (
            "Your FDR Drama Pro activation is ready.\n\n"
            f"Plan: {generated_state['plan']}\n"
            f"Expires: {generated_state['expiry']}\n"
            f"Activation Key:\n{keys[0]}\n\n"
            "Open FDR Drama Pro → PRO PLANS, paste the key, then click Activate."
        )
        root.clipboard_clear()
        root.clipboard_append(message)
        root.update()
        status_var.set("✓ Customer message copied — ready to send.")

    message_button = tk.Button(actions, text="Copy customer message", command=copy_customer_message, bg="#172027", fg="#eef2f4", activebackground="#26323a", activeforeground="#ffffff", relief="flat", padx=13, pady=9, cursor="hand2", font=("Segoe UI", 8, "bold"))
    message_button.pack(side="right", padx=(8, 0))
    copy_button = tk.Button(actions, text="Copy key", command=copy_key, bg="#172027", fg="#eef2f4", activebackground="#26323a", activeforeground="#ffffff", relief="flat", padx=15, pady=9, cursor="hand2", font=("Segoe UI", 8, "bold"))
    copy_button.pack(side="right", padx=(8, 0))
    generate_button = tk.Button(actions, text="Generate secure key", command=generate, bg="#e0a348", fg="#171009", activebackground="#f0ba61", activeforeground="#171009", relief="flat", padx=17, pady=9, cursor="hand2", font=("Segoe UI", 8, "bold"))
    generate_button.pack(side="right")
    root.bind("<Control-g>", lambda _event: generate())
    root.mainloop()


if __name__ == "__main__":
    run_gui()
