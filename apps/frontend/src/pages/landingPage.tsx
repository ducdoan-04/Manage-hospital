import { Link } from "react-router-dom";
import { APP_ROUTES } from "../constants/appRoutes";
import {
  ArrowRight,
  Building2,
  Calendar,
  CheckCircle,
  ClipboardList,
  HeartPulse,
  Lock,
  Pill,
  ShieldAlert,
  Stethoscope,
  Users,
} from "lucide-react";

const featureCards = [
  {
    icon: Users,
    title: "Bệnh nhân 360°",
    description:
      "Quản lý toàn diện hồ sơ bệnh án điện tử, phân loại cấp cứu Triage, buồng giường nội trú và thông tin BHYT.",
  },
  {
    icon: ClipboardList,
    title: "Kế hoạch Điều trị & Chăm sóc",
    description:
      "Theo dõi chẩn đoán lâm sàng, phác đồ điều trị, can thiệp điều dưỡng chuyên sâu và hội chẩn đa chuyên khoa.",
  },
  {
    icon: Pill,
    title: "eMAR Quản lý Cấp phát thuốc",
    description:
      "Quy trình phát thuốc 5 đúng, đối chiếu liều dùng, tương tác thuốc và cảnh báo dị ứng tức thì cho điều dưỡng.",
  },
  {
    icon: Calendar,
    title: "Lịch trực & Khám bệnh",
    description:
      "Điều phối ca trực bác sĩ, lịch khám chuyên khoa, phân bổ điều dưỡng chăm sóc theo tỷ lệ định biên an toàn.",
  },
];

const workflowSteps = [
  "Tiếp nhận & Cấp cứu",
  "Đánh giá lâm sàng ban đầu",
  "Lập phác đồ & Chăm sóc",
  "Y lệnh & Cấp phát thuốc",
  "Xuất viện & Quyết toán BHYT",
];

const stats = [
  { value: "24/7", label: "Giám sát lâm sàng liên tục" },
  { value: "100%", label: "Chuẩn Bệnh án điện tử (EMR)" },
  { value: "BHYT", label: "Liên thông viện phí thông minh" },
];

const roleCards = [
  {
    title: "Ban Giám đốc & Trưởng khoa",
    description: "Giám sát tổng quan công suất buồng giường, phê duyệt phác đồ chuyên môn, kiểm soát viện phí và an toàn người bệnh.",
  },
  {
    title: "Bác sĩ Chuyên khoa / Hội chẩn",
    description: "Khám bệnh, chỉ định cận lâm sàng, lập kế hoạch điều trị, ký số hồ sơ bệnh án và duyệt chỉ định thuốc.",
  },
  {
    title: "Điều dưỡng & Kỹ thuật viên",
    description: "Ghi nhận chỉ số sinh tồn tại giường, thực hiện quy trình cấp thuốc eMAR, chăm sóc người bệnh và báo cáo sự cố.",
  },
];

export function LandingPage() {
  return (
    <main className="landing-page">
      <nav className="landing-nav" aria-label="Landing navigation">
        <Link className="landing-brand" to={APP_ROUTES.LANDING}>
          <span className="landing-brand__icon">
            <HeartPulse size={24} />
          </span>
          <span>
            <strong>MedCare Hospital</strong>
            <small>Hệ thống Quản lý Bệnh viện Đa khoa</small>
          </span>
        </Link>

        <div className="landing-nav__links">
          <a href="#features">Tính năng</a>
          <a href="#workflow">Quy trình</a>
          <a href="#roles">Phân quyền</a>
        </div>

        <div className="landing-nav__actions">
          <Link className="landing-nav__login" to={APP_ROUTES.LOGIN}>
            Đăng nhập
          </Link>
          <Link className="landing-nav__signup" to={APP_ROUTES.REGISTER}>
            Đăng ký
          </Link>
        </div>
      </nav>

      <section className="landing-hero">
        <div className="landing-hero__content">
          <span className="landing-eyebrow">
            <ShieldAlert size={16} />
            Nền tảng Y tế Số & Quản trị Bệnh viện
          </span>

          <h1>
            Quản lý Bệnh viện Đa khoa thông minh, chuẩn y khoa và an toàn người bệnh.
          </h1>

          <p>
            Nền tảng quản lý bệnh viện hiện đại chuẩn hóa toàn diện quy trình tiếp nhận,
            hồ sơ bệnh án điện tử (EMR), quản lý buồng giường, quy trình cấp phát thuốc eMAR,
            giám sát chỉ số sinh tồn và quyết toán viện phí BHYT.
          </p>

          <div className="landing-hero__actions">
            <Link className="landing-primary-btn" to={APP_ROUTES.LOGIN}>
              Đăng nhập hệ thống
              <ArrowRight size={18} />
            </Link>
            <Link className="landing-secondary-btn" to={APP_ROUTES.DASHBOARD}>
              Xem bảng điều khiển
            </Link>
          </div>

          <div className="landing-stats" aria-label="Platform highlights">
            {stats.map((stat) => (
              <div key={stat.label}>
                <strong>{stat.value}</strong>
                <span>{stat.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="landing-hero__visual" aria-label="Dashboard preview">
          <div className="landing-dashboard-card landing-dashboard-card--main">
            <div className="landing-card-header">
              <div>
                <span>Giám sát thời gian thực</span>
                <strong>Trung tâm Điều hành Bệnh viện</strong>
              </div>
              <span className="landing-live-pill">Trực tuyến</span>
            </div>

            <div className="landing-care-row landing-care-row--active">
              <span>
                <Users size={18} />
              </span>
              <div>
                <strong>128 bệnh nhân nội trú</strong>
                <small>12 ca chờ phân luồng cấp cứu</small>
              </div>
              <b>+8%</b>
            </div>

            <div className="landing-care-row">
              <span>
                <Pill size={18} />
              </span>
              <div>
                <strong>Phiên cấp thuốc eMAR</strong>
                <small>34 lượt theo giờ y lệnh hôm nay</small>
              </div>
              <b>98%</b>
            </div>

            <div className="landing-care-row">
              <span>
                <Calendar size={18} />
              </span>
              <div>
                <strong>Ca trực Bác sĩ & Khám chuyên khoa</strong>
                <small>7 phiên hội chẩn liên viện</small>
              </div>
              <b>Đúng tiến độ</b>
            </div>

            <div className="landing-progress-panel">
              <div>
                <span>Tiến độ hoàn thành kế hoạch chăm sóc</span>
                <strong>89%</strong>
              </div>
              <div className="landing-progress-track">
                <span />
              </div>
            </div>
          </div>

          <div className="landing-floating-card landing-floating-card--top">
            <Lock size={17} />
            <span>Bảo mật dữ liệu y tế & Phân quyền RBAC</span>
          </div>

          <div className="landing-floating-card landing-floating-card--bottom">
            <CheckCircle size={17} />
            <span>Đồng bộ chỉ số sinh tồn tại giường</span>
          </div>
        </div>
      </section>

      <section className="landing-section" id="features">
        <div className="landing-section__heading">
          <span className="landing-eyebrow">Phân hệ chuyên môn</span>
          <h2>Giải pháp quản lý y tế toàn diện cho các khoa phòng</h2>
          <p>
            Tích hợp đầy đủ các luồng nghiệp vụ từ phòng tiếp đón cấp cứu, các khoa nội trú,
            khoa ngoại phẫu thuật, dược lâm sàng cho đến ban điều hành.
          </p>
        </div>

        <div className="landing-feature-grid">
          {featureCards.map((feature) => {
            const Icon = feature.icon;

            return (
              <article className="landing-feature-card" key={feature.title}>
                <span>
                  <Icon size={24} />
                </span>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="landing-workflow" id="workflow">
        <div>
          <span className="landing-eyebrow">Quy trình chuẩn hóa</span>
          <h2>Luồng điều trị khép kín từ tiếp nhận đến xuất viện</h2>
          <p>
            Được chuẩn hóa theo các quy chế chuyên môn của Bộ Y tế, giúp đội ngũ y bác sĩ
            và điều dưỡng thao tác nhanh chóng, chính xác.
          </p>
        </div>

        <div className="landing-workflow__steps">
          {workflowSteps.map((step, index) => (
            <div className="landing-step" key={step}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{step}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="landing-section landing-section--roles" id="roles">
        <div className="landing-section__heading">
          <span className="landing-eyebrow">Phân quyền chuyên môn</span>
          <h2>Tối ưu trải nghiệm cho từng vị trí công tác y tế</h2>
        </div>

        <div className="landing-role-grid">
          {roleCards.map((role) => (
            <article className="landing-role-card" key={role.title}>
              <div className="landing-role-card__icon">
                <Building2 size={22} />
              </div>
              <h3>{role.title}</h3>
              <p>{role.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-cta">
        <div>
          <span className="landing-eyebrow">Sẵn sàng vận hành</span>
          <h2>Bắt đầu cùng MedCare Hospital System</h2>
          <p>
            Truy cập cổng đăng nhập nhân viên y tế hoặc mở bảng điều khiển quản trị để trải nghiệm hệ thống.
          </p>
        </div>
        <div className="landing-cta__actions">
          <Link className="landing-primary-btn" to={APP_ROUTES.LOGIN}>
            Đăng nhập hệ thống
            <ArrowRight size={18} />
          </Link>
          <Link className="landing-secondary-btn landing-secondary-btn--light" to={APP_ROUTES.DASHBOARD}>
            Xem bảng điều khiển
          </Link>
        </div>
      </section>
    </main>
  );
}
