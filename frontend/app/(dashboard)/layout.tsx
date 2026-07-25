import { Sidebar } from "@/components/shared/sidebar";
import { ToastProvider } from "@/components/shared/toast-provider";
import { NotificationProvider } from "@/components/shared/notification-center";
import { PageErrorBoundary } from "@/components/shared/page-error-boundary";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <NotificationProvider>
      <ToastProvider>
        <div className="min-h-screen bg-secondary-bg">
          <Sidebar />

          {/* Main content area — offset by sidebar width on desktop */}
          <main
            className="min-h-screen lg:ml-64"
            id="main-content"
          >
            <div className="mx-auto max-w-[1280px] px-4 py-4 md:px-8 md:py-8">
              <PageErrorBoundary>
                {children}
              </PageErrorBoundary>
            </div>
          </main>
        </div>
      </ToastProvider>
    </NotificationProvider>
  );
}
