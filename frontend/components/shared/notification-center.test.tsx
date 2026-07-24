import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { NotificationProvider, useNotifications } from "./notification-center";
import type { ReactNode } from "react";

function wrapper({ children }: { children: ReactNode }) {
  return <NotificationProvider>{children}</NotificationProvider>;
}

describe("NotificationProvider", () => {
  it("throws when useNotifications is used outside provider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => {
      renderHook(() => useNotifications());
    }).toThrow("useNotifications must be used within a <NotificationProvider>");
    spy.mockRestore();
  });

  it("starts with empty notifications and zero unread count", () => {
    const { result } = renderHook(() => useNotifications(), { wrapper });

    expect(result.current.notifications).toEqual([]);
    expect(result.current.unreadCount).toBe(0);
  });

  it("addNotification adds a notification with auto-generated id and timestamp", () => {
    const { result } = renderHook(() => useNotifications(), { wrapper });

    act(() => {
      result.current.addNotification({
        type: "pipeline_complete",
        title: "Resume processed",
        message: "John Doe has been scored.",
      });
    });

    expect(result.current.notifications).toHaveLength(1);
    expect(result.current.notifications[0].title).toBe("Resume processed");
    expect(result.current.notifications[0].message).toBe("John Doe has been scored.");
    expect(result.current.notifications[0].type).toBe("pipeline_complete");
    expect(result.current.notifications[0].read).toBe(false);
    expect(result.current.notifications[0].id).toMatch(/^notif-/);
    expect(result.current.notifications[0].timestamp).toBeInstanceOf(Date);
    expect(result.current.unreadCount).toBe(1);
  });

  it("markRead marks a specific notification as read", () => {
    const { result } = renderHook(() => useNotifications(), { wrapper });

    act(() => {
      result.current.addNotification({
        type: "billing_warning",
        title: "Usage warning",
        message: "80% of resume reviews used.",
      });
    });

    const id = result.current.notifications[0].id;

    act(() => {
      result.current.markRead(id);
    });

    expect(result.current.notifications[0].read).toBe(true);
    expect(result.current.unreadCount).toBe(0);
  });

  it("markAllRead marks all notifications as read", () => {
    const { result } = renderHook(() => useNotifications(), { wrapper });

    act(() => {
      result.current.addNotification({
        type: "pipeline_complete",
        title: "Done 1",
        message: "msg 1",
      });
      result.current.addNotification({
        type: "email_sent",
        title: "Done 2",
        message: "msg 2",
      });
    });

    expect(result.current.unreadCount).toBe(2);

    act(() => {
      result.current.markAllRead();
    });

    expect(result.current.unreadCount).toBe(0);
    expect(result.current.notifications.every((n) => n.read)).toBe(true);
  });

  it("removeNotification removes a specific notification", () => {
    const { result } = renderHook(() => useNotifications(), { wrapper });

    act(() => {
      result.current.addNotification({
        type: "info",
        title: "Test",
        message: "msg",
      });
    });

    const id = result.current.notifications[0].id;

    act(() => {
      result.current.removeNotification(id);
    });

    expect(result.current.notifications).toHaveLength(0);
  });

  it("clearAll removes all notifications", () => {
    const { result } = renderHook(() => useNotifications(), { wrapper });

    act(() => {
      result.current.addNotification({
        type: "info",
        title: "A",
        message: "a",
      });
      result.current.addNotification({
        type: "error",
        title: "B",
        message: "b",
      });
    });

    expect(result.current.notifications).toHaveLength(2);

    act(() => {
      result.current.clearAll();
    });

    expect(result.current.notifications).toHaveLength(0);
    expect(result.current.unreadCount).toBe(0);
  });

  it("newest notifications appear first (prepended)", () => {
    const { result } = renderHook(() => useNotifications(), { wrapper });

    act(() => {
      result.current.addNotification({
        type: "info",
        title: "First",
        message: "first",
      });
    });

    act(() => {
      result.current.addNotification({
        type: "info",
        title: "Second",
        message: "second",
      });
    });

    expect(result.current.notifications[0].title).toBe("Second");
    expect(result.current.notifications[1].title).toBe("First");
  });

  it("caps notifications at 50", () => {
    const { result } = renderHook(() => useNotifications(), { wrapper });

    act(() => {
      for (let i = 0; i < 55; i++) {
        result.current.addNotification({
          type: "info",
          title: `Notification ${i}`,
          message: `msg ${i}`,
        });
      }
    });

    expect(result.current.notifications.length).toBeLessThanOrEqual(50);
  });
});
