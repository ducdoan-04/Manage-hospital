# -*- coding: utf-8 -*-
"""
Script to generate the official Graduation Project Outline (Đề cương chi tiết đồ án tốt nghiệp)
in Microsoft Word (.docx) format for VKU (Vietnam - Korea University of Information and Communication Technology).
"""

import sys
import docx
from docx.shared import Inches, Pt, RGBColor, Cm
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import nsdecls, qn

def set_cell_margins(cell, top=100, bottom=100, left=150, right=150):
    """Set inner padding for table cells in dxa (1 pt = 20 dxa)."""
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = OxmlElement('w:tcMar')
    for margin_name, val in [('top', top), ('bottom', bottom), ('left', left), ('right', right)]:
        node = OxmlElement(f'w:{margin_name}')
        node.set(qn('w:w'), str(val))
        node.set(qn('w:type'), 'dxa')
        tcMar.append(node)
    tcPr.append(tcMar)

def set_cell_background(cell, fill_hex):
    """Set background color of a table cell."""
    tcPr = cell._tc.get_or_add_tcPr()
    shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{fill_hex}"/>')
    tcPr.append(shd)

def set_table_borders(table, color="D3D3D3", sz="4", val="single"):
    """Set solid borders for the entire table."""
    tblPr = table._tbl.tblPr
    borders = parse_xml(
        f'<w:tblBorders {nsdecls("w")}>'
        f'  <w:top w:val="{val}" w:sz="{sz}" w:space="0" w:color="{color}"/>'
        f'  <w:bottom w:val="{val}" w:sz="{sz}" w:space="0" w:color="{color}"/>'
        f'  <w:left w:val="{val}" w:sz="{sz}" w:space="0" w:color="{color}"/>'
        f'  <w:right w:val="{val}" w:sz="{sz}" w:space="0" w:color="{color}"/>'
        f'  <w:insideH w:val="{val}" w:sz="{sz}" w:space="0" w:color="{color}"/>'
        f'  <w:insideV w:val="{val}" w:sz="{sz}" w:space="0" w:color="{color}"/>'
        f'</w:tblBorders>'
    )
    tblPr.append(borders)

def remove_table_borders(table):
    """Remove all borders from a table."""
    tblPr = table._tbl.tblPr
    borders = parse_xml(
        f'<w:tblBorders {nsdecls("w")}>'
        f'  <w:top w:val="none"/>'
        f'  <w:bottom w:val="none"/>'
        f'  <w:left w:val="none"/>'
        f'  <w:right w:val="none"/>'
        f'  <w:insideH w:val="none"/>'
        f'  <w:insideV w:val="none"/>'
        f'</w:tblBorders>'
    )
    tblPr.append(borders)

def format_run(run, font_name="Times New Roman", size_pt=13, bold=False, italic=False, color_rgb=(0,0,0)):
    run.font.name = font_name
    run.font.size = Pt(size_pt)
    run.bold = bold
    run.italic = italic
    run.font.color.rgb = RGBColor(*color_rgb)
    # Ensure Word uses Times New Roman for complex scripts
    rPr = run._r.get_or_add_rPr()
    rFonts = OxmlElement('w:rFonts')
    rFonts.set(qn('w:ascii'), font_name)
    rFonts.set(qn('w:hAnsi'), font_name)
    rFonts.set(qn('w:cs'), font_name)
    rPr.append(rFonts)

def add_heading_1(doc, text):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(12)
    p.paragraph_format.space_after = Pt(4)
    p.paragraph_format.line_spacing = 1.3
    run = p.add_run(text)
    format_run(run, font_name="Times New Roman", size_pt=13.5, bold=True, color_rgb=(0, 51, 102))
    return p

def add_heading_2(doc, text):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(8)
    p.paragraph_format.space_after = Pt(3)
    p.paragraph_format.line_spacing = 1.3
    run = p.add_run(text)
    format_run(run, font_name="Times New Roman", size_pt=13, bold=True, color_rgb=(20, 20, 20))
    return p

def add_heading_3(doc, text):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(6)
    p.paragraph_format.space_after = Pt(2)
    p.paragraph_format.line_spacing = 1.3
    run = p.add_run(text)
    format_run(run, font_name="Times New Roman", size_pt=13, bold=True, italic=True, color_rgb=(40, 40, 40))
    return p

def add_body_paragraph(doc, text, bold_prefix="", indent_first_line=0.63):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(4)
    p.paragraph_format.line_spacing = 1.3
    p.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    if indent_first_line > 0:
        p.paragraph_format.first_line_indent = Cm(indent_first_line)
    
    if bold_prefix:
        r_pre = p.add_run(bold_prefix)
        format_run(r_pre, font_name="Times New Roman", size_pt=13, bold=True)
    
    if text:
        r_text = p.add_run(text)
        format_run(r_text, font_name="Times New Roman", size_pt=13, bold=False)
    return p

def add_bullet_item(doc, text, bold_prefix=""):
    p = doc.add_paragraph(style='List Bullet')
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(3)
    p.paragraph_format.line_spacing = 1.25
    p.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    p.paragraph_format.left_indent = Cm(0.75)
    
    if bold_prefix:
        r_pre = p.add_run(bold_prefix)
        format_run(r_pre, font_name="Times New Roman", size_pt=13, bold=True)
    
    if text:
        r_text = p.add_run(text)
        format_run(r_text, font_name="Times New Roman", size_pt=13, bold=False)
    return p

def build_document():
    doc = docx.Document()
    
    # Page setup: A4, Margins: Top 2cm, Bottom 2cm, Left 3cm, Right 2cm
    for section in doc.sections:
        section.page_width = Cm(21.0)
        section.page_height = Cm(29.7)
        section.top_margin = Cm(2.0)
        section.bottom_margin = Cm(2.0)
        section.left_margin = Cm(3.0)
        section.right_margin = Cm(2.0)

    # -------------------------------------------------------------
    # HEADER TABLE (2 COLUMNS, BORDERLESS)
    # -------------------------------------------------------------
    tbl_header = doc.add_table(rows=1, cols=2)
    tbl_header.alignment = WD_TABLE_ALIGNMENT.CENTER
    remove_table_borders(tbl_header)
    tbl_header.autofit = False
    
    # Set widths for columns
    col_widths = [Cm(8.8), Cm(7.2)]
    for row in tbl_header.rows:
        for i, w in enumerate(col_widths):
            row.cells[i].width = w

    # Left cell: University & Faculty
    c_left = tbl_header.cell(0, 0)
    set_cell_margins(c_left, top=40, bottom=40, left=40, right=40)
    p_u1 = c_left.paragraphs[0]
    p_u1.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_u1.paragraph_format.space_after = Pt(2)
    p_u1.paragraph_format.line_spacing = 1.15
    r = p_u1.add_run("TRƯỜNG ĐẠI HỌC CÔNG NGHỆ THÔNG TIN\nVÀ TRUYỀN THÔNG VIỆT - HÀN")
    format_run(r, font_name="Times New Roman", size_pt=10.5, bold=True)
    
    p_u2 = c_left.add_paragraph()
    p_u2.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_u2.paragraph_format.space_after = Pt(2)
    r2 = p_u2.add_run("KHOA KHOA HỌC MÁY TÍNH")
    format_run(r2, font_name="Times New Roman", size_pt=11, bold=True)
    
    p_line_left = c_left.add_paragraph()
    p_line_left.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_line_left.paragraph_format.space_after = Pt(0)
    r_line_l = p_line_left.add_run("---------------")
    format_run(r_line_l, font_name="Times New Roman", size_pt=10, bold=True)

    # Right cell: National Motto
    c_right = tbl_header.cell(0, 1)
    set_cell_margins(c_right, top=40, bottom=40, left=40, right=40)
    p_m1 = c_right.paragraphs[0]
    p_m1.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_m1.paragraph_format.space_after = Pt(2)
    p_m1.paragraph_format.line_spacing = 1.15
    r_m1 = p_m1.add_run("CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM")
    format_run(r_m1, font_name="Times New Roman", size_pt=10.5, bold=True)

    p_m2 = c_right.add_paragraph()
    p_m2.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_m2.paragraph_format.space_after = Pt(2)
    r_m2 = p_m2.add_run("Độc lập - Tự do - Hạnh phúc")
    format_run(r_m2, font_name="Times New Roman", size_pt=11, bold=True)

    p_line_right = c_right.add_paragraph()
    p_line_right.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_line_right.paragraph_format.space_after = Pt(0)
    r_line_r = p_line_right.add_run("-------------------")
    format_run(r_line_r, font_name="Times New Roman", size_pt=10, bold=True)

    # Spacing
    p_space = doc.add_paragraph()
    p_space.paragraph_format.space_before = Pt(8)
    p_space.paragraph_format.space_after = Pt(4)

    # -------------------------------------------------------------
    # DOCUMENT TITLE
    # -------------------------------------------------------------
    p_title = doc.add_paragraph()
    p_title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_title.paragraph_format.space_after = Pt(14)
    r_t = p_title.add_run("ĐỀ CƯƠNG CHI TIẾT ĐỒ ÁN, KHÓA LUẬN TỐT NGHIỆP")
    format_run(r_t, font_name="Times New Roman", size_pt=15, bold=True, color_rgb=(0, 51, 102))

    # Topic name
    p_topic = doc.add_paragraph()
    p_topic.paragraph_format.space_after = Pt(6)
    p_topic.paragraph_format.line_spacing = 1.3
    r_tlabel = p_topic.add_run("Tên đề tài: ")
    format_run(r_tlabel, font_name="Times New Roman", size_pt=13, bold=True)
    r_tname = p_topic.add_run("Xây dựng không gian làm việc thông minh tích hợp trí tuệ nhân tạo hỗ trợ lập kế hoạch dựa trên mô hình DAG và điều phối nhân sự\n")
    format_run(r_tname, font_name="Times New Roman", size_pt=13, bold=True)
    r_ten = p_topic.add_run("(Building an AI-Integrated Smart Workspace Platform for DAG-Based Planning and Workforce Dispatching)")
    format_run(r_ten, font_name="Times New Roman", size_pt=12.5, italic=True)

    # Student info
    p_stulabel = doc.add_paragraph()
    p_stulabel.paragraph_format.space_before = Pt(4)
    p_stulabel.paragraph_format.space_after = Pt(4)
    r_stu = p_stulabel.add_run("Sinh viên thực hiện:")
    format_run(r_stu, font_name="Times New Roman", size_pt=13, bold=True)

    # Student table
    tbl_student = doc.add_table(rows=2, cols=5)
    tbl_student.alignment = WD_TABLE_ALIGNMENT.CENTER
    set_table_borders(tbl_student, color="808080", sz="4")
    tbl_student.autofit = False

    stu_widths = [Cm(1.2), Cm(4.8), Cm(2.4), Cm(2.2), Cm(5.4)]
    for row in tbl_student.rows:
        for i, w in enumerate(stu_widths):
            row.cells[i].width = w

    headers_stu = ["TT", "Họ tên sinh viên", "MSV", "Lớp", "Ngành"]
    for i, h in enumerate(headers_stu):
        cell = tbl_student.cell(0, i)
        set_cell_background(cell, "EAECEE")
        set_cell_margins(cell, top=100, bottom=100, left=100, right=100)
        p = cell.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r = p.add_run(h)
        format_run(r, font_name="Times New Roman", size_pt=12, bold=True)

    data_stu = ["1", "Đặng Hồng Nguyên", "22IT188", "22SE2", "Công nghệ phần mềm (Kỹ sư)"]
    for i, d in enumerate(data_stu):
        cell = tbl_student.cell(1, i)
        set_cell_margins(cell, top=100, bottom=100, left=100, right=100)
        p = cell.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER if i in [0, 2, 3] else WD_ALIGN_PARAGRAPH.LEFT
        r = p.add_run(d)
        format_run(r, font_name="Times New Roman", size_pt=12.5, bold=(i==1))

    # Supervisor
    p_sup = doc.add_paragraph()
    p_sup.paragraph_format.space_before = Pt(8)
    p_sup.paragraph_format.space_after = Pt(12)
    r_suplabel = p_sup.add_run("Người hướng dẫn: ")
    format_run(r_suplabel, font_name="Times New Roman", size_pt=13, bold=True)
    r_supname = p_sup.add_run("THS. LƯƠNG KHÁNH TÝ")
    format_run(r_supname, font_name="Times New Roman", size_pt=13, bold=True)

    # -------------------------------------------------------------
    # 1. LÝ DO CHỌN ĐỀ TÀI
    # -------------------------------------------------------------
    add_heading_1(doc, "1. Lý do chọn đề tài")
    
    add_body_paragraph(
        doc,
        "Lý do cốt lõi lựa chọn đề tài xuất phát từ sự mâu thuẫn căn bản giữa bản chất kỹ nghệ phần mềm và mô hình quản trị hiện nay: Trong khi quy trình phát triển phần mềm thực tế là một mạng lưới các tác vụ phụ thuộc phi tuyến phức tạp (Nonlinear Task Dependency Network) và năng lực nhân sự liên tục biến động, thì các công cụ quản lý dự án phổ biến (như Jira, Trello, Asana) lại vận hành dựa trên cơ chế ghi nhận thụ động (passive ticketing), kế hoạch dạng danh sách phẳng (flat backlog) và cào bằng nội dung công việc cho mọi cấp bậc nhân sự."
    )
    
    add_body_paragraph(
        doc,
        "Sự bất đối xứng mang tính hệ thống này dẫn đến nhiều hệ lụy nghiêm trọng trong quá trình vận hành đội ngũ kỹ thuật:"
    )
    
    add_bullet_item(
        doc,
        "Quản trị viên và Tech Lead phải chịu áp lực quá tải nhận thức cực lớn khi phải tự tay tính toán, xâu chuỗi hàng trăm tác vụ phụ thuộc chéo. Khi xuất hiện nút thắt kỹ thuật hoặc yêu cầu thay đổi, toàn bộ tiến độ dự án dễ dàng bị đổ vỡ dây chuyền (cascading delay) do thiếu tầm nhìn bao quát về chuỗi đường găng (Critical Path).",
        bold_prefix="Quá tải nhận thức và nguy cơ tắc nghẽn tiến độ dây chuyền: "
    )
    
    add_bullet_item(
        doc,
        "Cơ chế phân bổ công việc theo danh sách phẳng thường dựa vào cảm tính hoặc trạng thái nhàn rỗi nhất thời, thay vì ghép nối chính xác giữa yêu cầu kỹ thuật và hồ sơ năng lực thực tế. Hậu quả là các kỹ sư chủ chốt (Senior) liên tục bị quá tải phụ tải (burnout), trong khi năng lực của các nhân sự khác chưa được khai thác hiệu quả, dẫn đến chỉ số mất cân bằng phụ tải công việc (Workload Gini Index) ở mức báo động.",
        bold_prefix="Bất cập trong phân bổ phụ tải và nguy cơ kiệt sức của nhân sự nòng cốt: "
    )
    
    add_bullet_item(
        doc,
        "Khoảng cách kỹ năng (Skill Gap) lớn giữa Senior và Fresher/Intern tạo ra gánh nặng kèm cặp (mentorship overhead) dai dẳng. Kỹ sư kỳ cựu liên tục bị gián đoạn trạng thái tập trung sâu (Deep Work) bởi các câu hỏi phát sinh cơ bản của nhân sự mới, làm giảm đáng kể hiệu suất tổng thể của toàn nhóm.",
        bold_prefix="Gánh nặng kèm cặp và suy giảm năng suất làm việc tập trung: "
    )
    
    add_bullet_item(
        doc,
        "Hồ sơ năng lực của nhân sự thường chỉ tồn tại dưới dạng đánh giá định tính, CV tĩnh hoặc báo cáo hiệu suất nửa năm một lần, hoàn toàn không phản ánh tức thời trình độ kỹ thuật thực tế thông qua chất lượng nghiệm thu mã nguồn (Code Review / Pull Request).",
        bold_prefix="Thiếu hụt cơ chế thích ứng và cập nhật năng lực thời gian thực: "
    )

    add_body_paragraph(
        doc,
        "Nhằm giải quyết triệt để những nút thắt trên, đề tài đề xuất giải pháp xây dựng một 'Không gian làm việc thông minh' (Smart Workspace Platform) tích hợp trí tuệ nhân tạo, kết hợp lý thuyết đồ thị có hướng không chu trình (DAG), các giải thuật tìm kiếm lai (Hybrid Search), điều phối Heuristic cân bằng tải, tự sinh hướng dẫn vi mô (Micro-checklist) và mô hình cập nhật năng lực Elo. Đề tài vừa có tính cấp thiết cao trong bối cảnh các doanh nghiệp phần mềm đang tích cực chuyển đổi số, vừa mang giá trị khoa học và ứng dụng thực tiễn sâu sắc."
    )

    # -------------------------------------------------------------
    # 2. MỤC TIÊU VÀ NHIỆM VỤ ĐỀ TÀI
    # -------------------------------------------------------------
    add_heading_1(doc, "2. Mục tiêu và nhiệm vụ đề tài")
    
    add_heading_2(doc, "2.1. Mục tiêu tổng quát")
    add_body_paragraph(
        doc,
        "Mục tiêu tổng quát của đề tài là nghiên cứu, thiết kế và hiện thực hóa một nền tảng không gian làm việc thông minh (Smart Workspace Platform) tích hợp trí tuệ nhân tạo, có khả năng chuyển đổi quy trình quản trị dự án phần mềm từ mô hình ghi nhận thụ động sang hệ thống điều phối chủ động và thích ứng; giải quyết triệt để sự phi lý của kế hoạch danh sách phẳng và sự cào bằng năng lực nhân sự, qua đó tối ưu hóa thời gian hoàn thành dự án, cân bằng phụ tải làm việc và nâng cao hiệu suất làm việc nhóm."
    )

    add_heading_2(doc, "2.2. Mục tiêu cụ thể")
    add_bullet_item(
        doc,
        "Nghiên cứu và ứng dụng mô hình Đồ thị có hướng không chu trình (DAG), kết hợp thuật toán Kahn và phương pháp Đường găng (CPM) nhằm tự động phân rã yêu cầu dự án thành mạng lưới công việc có trật tự logic, loại bỏ hoàn toàn nguy cơ xung đột chu trình và dự báo chính xác các mốc thời gian trọng yếu.",
        bold_prefix="Về mô hình hóa và kiểm soát kế hoạch: "
    )
    add_bullet_item(
        doc,
        "Xây dựng đường ống Tìm kiếm lai (Hybrid Search) tích hợp kỹ thuật tìm kiếm từ khóa (BM25/Full-text Search) và tìm kiếm ngữ nghĩa không gian véc-tơ (pgvector) thông qua thuật toán Hợp nhất Hạng nghịch đảo (RRF), giúp truy xuất và xếp hạng ứng viên phù hợp với độ chính xác cao (Precision@3 > 85%).",
        bold_prefix="Về tìm kiếm và ghép nối nhân sự: "
    )
    add_bullet_item(
        doc,
        "Phát triển giải thuật Heuristic phân bổ có tính tải công việc nhằm tối ưu hóa thời gian hoàn thành dự án (Makespan) và đảm bảo công bằng phụ tải (hạ Hệ số Gini < 0.25).",
        bold_prefix="Về điều phối tối ưu và cân bằng phụ tải: "
    )
    add_bullet_item(
        doc,
        "Tích hợp mô hình ngôn ngữ lớn (LLM) để tự động sinh hướng dẫn vi mô (Micro-checklist) tùy biến theo khoảng cách kỹ năng (Skill Gap) của nhân sự, hỗ trợ Fresher/Intern làm việc độc lập và giảm trên 40% gián đoạn công việc của Senior.",
        bold_prefix="Về hỗ trợ thích ứng và rút ngắn khoảng cách kỹ năng: "
    )
    add_bullet_item(
        doc,
        "Thiết lập vòng lặp học hỏi liên tục bằng thuật toán xếp hạng Elo thích ứng, tự động cập nhật điểm năng lực kỹ thuật của lập trình viên sau mỗi lần nghiệm thu mã nguồn thực tế.",
        bold_prefix="Về cập nhật hồ sơ năng lực động: "
    )
    add_bullet_item(
        doc,
        "Xây dựng hoàn chỉnh ứng dụng web với giao diện tương tác trực quan (React Flow DAG, Adaptive Kanban) và thực hiện đánh giá định lượng nghiêm ngặt thông qua ma trận kiểm thử triệt tiêu (Ablation Study).",
        bold_prefix="Về hiện thực hóa và kiểm thử hệ thống: "
    )

    add_heading_2(doc, "2.3. Nhiệm vụ của đề tài")
    add_bullet_item(
        doc,
        "Nghiên cứu cơ sở lý thuyết về cấu trúc dữ liệu đồ thị DAG, thuật toán sắp xếp tô-pô Kahn, phương pháp phân tích CPM, kỹ thuật tìm kiếm lai BM25 + Vector Embedding qua RRF, giải thuật Heuristic cân bằng tải, hệ số Gini và thuật toán xếp hạng Elo.",
        bold_prefix="Nhiệm vụ 1 - Nghiên cứu lý thuyết và giải thuật: "
    )
    add_bullet_item(
        doc,
        "Phân tích yêu cầu chức năng/phi chức năng; thiết kế kiến trúc hệ thống phân tầng (Client - Server - AI Engine - Database); thiết kế cơ sở dữ liệu quan hệ kết hợp véc-tơ trên PostgreSQL; thiết kế giao diện UI/UX tương tác trực quan.",
        bold_prefix="Nhiệm vụ 2 - Phân tích và thiết kế hệ thống: "
    )
    add_bullet_item(
        doc,
        "Xây dựng và hoàn thiện các phân hệ phần mềm: Core Engine xử lý DAG và CPM, Pipeline Hybrid Search RRF trên pgvector, Dispatcher Heuristic tính tải, Engine tích hợp LLM sinh Micro-checklist, và phân hệ Kanban tương tác cập nhật Elo.",
        bold_prefix="Nhiệm vụ 3 - Lập trình hiện thực hóa giải pháp: "
    )
    add_bullet_item(
        doc,
        "Thiết kế tập dữ liệu mô phỏng chuẩn hóa (Synthetic Benchmark Dataset) gồm 100 kỹ sư và 250 tác vụ; thiết lập kịch bản kiểm thử triệt tiêu (Ablation Study) nhằm đo lường Precision@3, Makespan, Hệ số Gini và độ trễ truy vấn hệ thống.",
        bold_prefix="Nhiệm vụ 4 - Thử nghiệm, đo lường và đánh giá định lượng: "
    )
    add_bullet_item(
        doc,
        "Tổng hợp toàn bộ quá trình nghiên cứu, hoàn thành báo cáo thuyết minh đồ án tốt nghiệp, chuẩn bị bộ mã nguồn kiểm thử và tài liệu bảo vệ trước Hội đồng chấm tốt nghiệp.",
        bold_prefix="Nhiệm vụ 5 - Hoàn thiện báo cáo và hồ sơ tốt nghiệp: "
    )

    # -------------------------------------------------------------
    # 3. ĐỐI TƯỢNG VÀ PHẠM VI ĐỀ TÀI
    # -------------------------------------------------------------
    add_heading_1(doc, "3. Đối tượng và phạm vi đề tài")
    
    add_heading_2(doc, "3.1. Đối tượng nghiên cứu")
    add_bullet_item(
        doc,
        "Mô hình Đồ thị có hướng không chu trình (Directed Acyclic Graph - DAG), thuật toán phát hiện chu trình và sắp xếp tô-pô Kahn, phương pháp Đường găng (Critical Path Method - CPM) trong kỹ nghệ phần mềm.",
        bold_prefix="Mô hình toán học và giải thuật lập lịch: "
    )
    add_bullet_item(
        doc,
        "Thuật toán đối sánh từ khóa BM25, mô hình nhúng véc-tơ ngữ nghĩa (Dense Vector Embeddings) trên cơ sở dữ liệu PostgreSQL mở rộng pgvector, và thuật toán Hợp nhất Hạng nghịch đảo (Reciprocal Rank Fusion - RRF).",
        bold_prefix="Kỹ thuật truy xuất thông tin lai (Hybrid Search): "
    )
    add_bullet_item(
        doc,
        "Giải thuật Heuristic điều phối có xét đến tải trọng hiện tại (Current Workload) và năng lực phù hợp; hệ số phân bổ bất bình đẳng Gini (Gini Coefficient) dùng để kiểm soát độ lệch tải.",
        bold_prefix="Giải thuật phân bổ phụ tải tối ưu: "
    )
    add_bullet_item(
        doc,
        "Công thức đánh giá đối đầu Elo và cơ chế cập nhật điểm thích ứng dựa trên kết quả nghiệm thu mã nguồn (Code Review Approval).",
        bold_prefix="Mô hình đánh giá năng lực động: "
    )
    add_bullet_item(
        doc,
        "Kỹ thuật Context Injection, Few-shot Prompting với Large Language Models (LLM) để sinh danh mục công việc vi mô (Micro-checklist) tùy biến theo khoảng cách trình độ.",
        bold_prefix="Kỹ thuật tạo sinh hướng dẫn vi mô thích ứng: "
    )

    add_heading_2(doc, "3.2. Đối tượng áp dụng")
    add_body_paragraph(
        doc,
        "Hệ thống hướng tới các nhóm phát triển phần mềm vừa và nhỏ (quy mô từ 10 đến 50 nhân sự) vận hành theo mô hình Agile/Scrum. Hệ thống phục vụ trực tiếp ba nhóm tác nhân chính:"
    )
    add_bullet_item(
        doc,
        "Sử dụng công cụ lập kế hoạch DAG, quan sát toàn diện đường găng, nhận diện sớm các nguy cơ tắc nghẽn tiến độ, và phê duyệt các gợi ý phân công nhân sự tối ưu tải từ hệ thống.",
        bold_prefix="Quản lý dự án / Tech Lead (PM): "
    )
    add_bullet_item(
        doc,
        "Tiếp nhận các tác vụ trọng yếu tương xứng với trình độ; tham gia nghiệm thu kết quả công việc (Code Review); giảm thiểu thời gian bị ngắt quãng nhờ hệ thống tự động hướng dẫn nhân sự mới.",
        bold_prefix="Kỹ sư phần mềm kỳ cựu (Senior/Mid-level Engineers): "
    )
    add_bullet_item(
        doc,
        "Nhận các tác vụ phù hợp với năng lực kèm theo Micro-checklist chi tiết, từng bước tiếp cận công nghệ mới độc lập, hạn chế tối đa các tình trạng bị nghẽn (blocker) do thiếu tài liệu hướng dẫn.",
        bold_prefix="Thực tập sinh / Kỹ sư mới (Intern / Fresher Engineers): "
    )

    add_heading_2(doc, "3.3. Phạm vi chức năng")
    add_body_paragraph(
        doc,
        "Hệ thống được thiết kế và triển khai trên nền tảng ứng dụng Web, phân định rõ ràng ranh giới phạm vi triển khai:"
    )
    add_bullet_item(
        doc,
        "(1) Tự động phân rã yêu cầu thành mạng lưới tác vụ DAG và kiểm tra chu trình bằng thuật toán Kahn; (2) Trực quan hóa tương tác đồ thị kế hoạch trên Canvas tương tác (sử dụng React Flow); (3) Xác định đường găng CPM và dự báo mốc tiến độ; (4) Truy xuất và xếp hạng nhân sự phù hợp bằng đường ống Hybrid Search RRF; (5) Điều phối công việc tự động/bán tự động bằng Heuristic cân bằng tải; (6) Tự sinh Micro-checklist hướng dẫn vi mô cho nhân sự cấp thấp dựa trên khoảng cách kỹ năng; (7) Quản lý trạng thái thực thi công việc trên bảng Kanban 4 cột; (8) Tự động cập nhật điểm năng lực Elo sau khi nghiệm thu hoàn tất.",
        bold_prefix="Phạm vi triển khai cốt lõi (In-scope): "
    )
    add_bullet_item(
        doc,
        "Để đảm bảo tính tập trung chuyên sâu vào bài toán lõi, đề tài chủ động loại trừ: (1) Phân hệ nhắn tin trò chuyện tức thời (Real-time Chat), cuộc gọi âm thanh/video; (2) Phân hệ chấm công, tính lương và quản lý nhân sự hành chính (HRM); (3) Tự động hóa quy trình CI/CD và triển khai hạ tầng đám mây; (4) Xây dựng ứng dụng di động bản địa (Native Mobile Apps).",
        bold_prefix="Phạm vi loại trừ (Out-of-scope): "
    )

    add_heading_2(doc, "3.4. Phạm vi dữ liệu và đánh giá thực nghiệm")
    add_bullet_item(
        doc,
        "Do yêu cầu bảo mật thông tin nội bộ của doanh nghiệp phần mềm, đề tài xây dựng và kiểm thử trên bộ dữ liệu mô phỏng chuẩn hóa (Synthetic Benchmark Dataset) bao gồm 100 hồ sơ kỹ sư (với đầy đủ thông tin kỹ năng, kinh nghiệm, điểm Elo, lịch sử hoàn thành task và mức tải hiện thời) cùng 3 kịch bản dự án phần mềm thực tế với hơn 250 tác vụ có quan hệ phụ thuộc đa chiều.",
        bold_prefix="Bộ dữ liệu kiểm nghiệm: "
    )
    add_bullet_item(
        doc,
        "Tập trung đo lường định lượng các chỉ số học thuật cốt lõi: Precision@3 và Mean Reciprocal Rank (MRR) của tìm kiếm nhân sự, Thời gian hoàn thành dự án tổng thể (Makespan), Hệ số mất cân bằng tải Gini (Gini Index), và độ trễ truy vấn hệ thống (Query Latency < 30ms) thông qua ma trận kiểm thử triệt tiêu (Ablation Study).",
        bold_prefix="Chỉ số đo lường: "
    )
    add_bullet_item(
        doc,
        "Đề tài được tiến hành trong khung thời gian 12 tuần (từ ngày 01/09/2026 đến ngày 20/12/2026).",
        bold_prefix="Khung thời gian thực hiện: "
    )

    # -------------------------------------------------------------
    # 4. PHƯƠNG PHÁP THỰC HIỆN
    # -------------------------------------------------------------
    add_heading_1(doc, "4. Phương pháp thực hiện")
    
    add_heading_2(doc, "4.1. Phương pháp nghiên cứu lý thuyết và giải thuật")
    add_bullet_item(
        doc,
        "Mô hình hóa toàn bộ kế hoạch dự án thành Đồ thị có hướng không chu trình G = (V, E), trong đó V là tập hợp các tác vụ và E là quan hệ phụ thuộc trước - sau. Sử dụng thuật toán Kahn (Topological Sort) dựa trên bậc vào (in-degree) để phát hiện tức thời mọi chu trình xung đột logic (Deadlock-free). Áp dụng phương pháp Đường găng (CPM) với các phép tính tiến (Forward Pass) và lùi (Backward Pass) để xác định thời điểm bắt đầu/kết thúc sớm nhất (ES/EF) và muộn nhất (LS/LF), tìm ra chuỗi tác vụ có độ trôi tự do bằng 0 (Slack = 0).",
        bold_prefix="Lý thuyết đồ thị và giải thuật lập lịch (DAG & CPM): "
    )
    add_bullet_item(
        doc,
        "Kết hợp hai nhánh truy xuất: nhánh 1 là tìm kiếm từ khóa dựa trên BM25 (tsvector/tsquery của PostgreSQL) đánh giá độ khớp từ vựng kỹ thuật đặc thù; nhánh 2 là tìm kiếm ngữ nghĩa dày đặc (Dense Vector Embeddings) sử dụng pgvector với khoảng cách Cosine đánh giá ngữ cảnh kinh nghiệm. Kết quả của hai nhánh được hợp nhất không tham số thông qua công thức Reciprocal Rank Fusion: RRF_Score(d) = Σ [1 / (k + r_m(d))], với k = 60.",
        bold_prefix="Kỹ thuật tìm kiếm lai (Hybrid Search with RRF): "
    )
    add_bullet_item(
        doc,
        "Phát triển hàm mục tiêu Heuristic kết hợp giữa độ phù hợp kỹ năng (Skill Match Score) và mức tải công việc hiện tại (Current Workload). Đưa vào Hệ số Gini để giám sát và phạt nặng các phương án phân bổ dồn tải lên cá nhân đơn lẻ, nhằm giữ cho phân phối công việc toàn nhóm luôn ở trạng thái cân bằng tối ưu.",
        bold_prefix="Giải thuật Heuristic điều phối có tính tải và Hệ số Gini: "
    )
    add_bullet_item(
        doc,
        "Thiết lập cơ chế cập nhật điểm kỹ năng dựa trên mô hình Elo: Mỗi khi một tác vụ được nghiệm thu thành công (PR merged), điểm số Elo của kỹ sư được điều chỉnh theo độ khó thực tế của tác vụ và đánh giá từ reviewer: R' = R + K * (S - E), giúp hồ sơ năng lực luôn phản ánh đúng năng lực thực tế.",
        bold_prefix="Mô hình thích ứng năng lực liên tục (Elo Rating): "
    )

    add_heading_2(doc, "4.2. Phương pháp phân tích, thiết kế và xây dựng hệ thống")
    add_bullet_item(
        doc,
        "Áp dụng phương pháp luận phát triển phần mềm linh hoạt (Agile/Scrum kết hợp Iterative Development) với các chu kỳ phát triển 2 tuần/sprint, cho phép kiểm thử và tích hợp liên tục từng phân hệ giải thuật vào giao diện.",
        bold_prefix="Mô hình phát triển: "
    )
    add_bullet_item(
        doc,
        "Thiết kế theo kiến trúc Client - Server phân tầng hiện đại (Clean / Layered Architecture):\n"
        "- Tầng giao diện người dùng (Presentation Layer): Xây dựng bằng Next.js/React kết hợp TailwindCSS; sử dụng thư viện React Flow để vẽ và tương tác trực tiếp với canvas đồ thị DAG; thư viện Drag-and-Drop cho bảng Kanban.\n"
        "- Tầng xử lý nghiệp vụ & AI (Application & Business Layer): Xây dựng RESTful API bằng NestJS/Node.js (hoặc FastAPI Python), tích hợp module tính toán đồ thị Kahn/CPM, xử lý đường ống RRF và giao tiếp với Large Language Models qua OpenAI API / Google Gemini API.\n"
        "- Tầng lưu trữ dữ liệu (Data Persistence Layer): Sử dụng PostgreSQL phiên bản mới tích hợp phần mở rộng pgvector, hỗ trợ cả dữ liệu quan hệ ACID chuẩn mực và chỉ mục véc-tơ HNSW (Hierarchical Navigable Small World) tối ưu hóa truy vấn tương đồng.",
        bold_prefix="Kiến trúc hệ thống: "
    )
    add_bullet_item(
        doc,
        "Đóng gói toàn bộ cơ sở dữ liệu, dịch vụ backend và frontend bằng Docker và Docker Compose, bảo đảm tính nhất quán môi trường từ phát triển, kiểm thử đến triển khai thực tế.",
        bold_prefix="Môi trường và đóng gói: "
    )

    add_heading_2(doc, "4.3. Phương pháp thử nghiệm và đánh giá")
    add_bullet_item(
        doc,
        "Xây dựng bộ dữ liệu mô phỏng đối chuẩn gồm 100 kỹ sư và 250 tác vụ với cấu trúc quan hệ phụ thuộc đa dạng (tuần tự, song song, hội tụ, phân kỳ) nhằm phản ánh sát thực tế sản xuất phần mềm.",
        bold_prefix="Thiết lập bộ dữ liệu thực nghiệm: "
    )
    add_bullet_item(
        doc,
        "Tiến hành thử nghiệm triệt tiêu đa biến (Ablation Study) qua từng cấu hình: So sánh mô hình DAG vs Mô hình danh sách phẳng; So sánh Hybrid Search (BM25 + Vector) vs Pure BM25 vs Pure Vector; So sánh Heuristic có tính tải vs Phân bổ ngẫu nhiên / Tham lam đơn thuần; So sánh hiệu quả của Micro-checklist trong việc hỗ trợ Intern.",
        bold_prefix="Thực nghiệm đối chuẩn (Ablation Study): "
    )
    add_bullet_item(
        doc,
        "Đo lường định lượng các chỉ số học thuật: Precision@3, MRR, Makespan tổng thể, Hệ số mất cân bằng Gini, độ trễ truy vấn (Query Latency), và thực hiện kiểm thử tự động với độ bao phủ kịch bản đạt trên 95%.",
        bold_prefix="Đo lường định lượng và kiểm thử: "
    )

    # -------------------------------------------------------------
    # 5. DỰ KIẾN KẾT QUẢ
    # -------------------------------------------------------------
    add_heading_1(doc, "5. Dự kiến kết quả")
    
    add_heading_2(doc, "5.1. Sản phẩm phần mềm")
    add_bullet_item(
        doc,
        "Nền tảng Smart Workspace Platform hoạt động hoàn chỉnh, ổn định trên môi trường web (staging/production), sở hữu giao diện người dùng thân thiện, trực quan và hiện đại.",
        bold_prefix="Hệ thống ứng dụng Web hoàn chỉnh: "
    )
    add_bullet_item(
        doc,
        "Cho phép hiển thị trực quan toàn bộ mạng lưới công việc dưới dạng sơ đồ nút - cạnh tương tác; hỗ trợ kéo thả kết nối phụ thuộc; tự động chạy thuật toán Kahn kiểm tra chu trình và đánh dấu đường găng CPM bằng màu sắc nổi bật.",
        bold_prefix="Phân hệ Canvas DAG tương tác: "
    )
    add_bullet_item(
        doc,
        "Tự động trích xuất yêu cầu tác vụ, chạy đường ống Hybrid Search RRF và Heuristic tính tải để đề xuất top 3 kỹ sư phù hợp nhất, kèm điểm số đối sánh minh bạch.",
        bold_prefix="Phân hệ Tìm kiếm lai và Điều phối Heuristic: "
    )
    add_bullet_item(
        doc,
        "Tích hợp LLM tự động sinh danh mục công việc vi mô (Micro-checklist) từng bước cho nhân sự mới dựa trên khoảng cách giữa kỹ năng cá nhân và yêu cầu của tác vụ.",
        bold_prefix="Phân hệ Tạo sinh Hướng dẫn vi mô thích ứng: "
    )
    add_bullet_item(
        doc,
        "Bảng Kanban 4 cột linh hoạt; cơ chế kích hoạt tự động tính toán và cập nhật điểm Elo năng lực của kỹ sư ngay khi tác vụ hoàn thành nghiệm thu mã nguồn.",
        bold_prefix="Phân hệ Bảng Kanban và Cập nhật Elo động: "
    )

    add_heading_2(doc, "5.2. Tài liệu kỹ thuật và học thuật")
    add_bullet_item(
        doc,
        "Báo cáo thuyết minh đồ án tốt nghiệp kỹ sư đầy đủ, chuẩn mực theo quy định của Nhà trường và Khoa Khoa học Máy tính (dự kiến từ 80 - 120 trang).",
        bold_prefix="Báo cáo toàn văn: "
    )
    add_bullet_item(
        doc,
        "Tài liệu phân tích yêu cầu (SRS), thiết kế kiến trúc và giải thuật (SDD), tài liệu hướng dẫn cài đặt, cấu hình cơ sở dữ liệu và vận hành hệ thống thông qua Docker Compose.",
        bold_prefix="Hồ sơ thiết kế kỹ thuật: "
    )
    add_bullet_item(
        doc,
        "Toàn bộ mã nguồn nguồn mở được tổ chức theo chuẩn Clean Code, đính kèm đầy đủ tài liệu API (Swagger/OpenAPI) và các bộ kiểm thử tự động (Unit Test / Integration Test).",
        bold_prefix="Bộ mã nguồn và kịch bản kiểm thử: "
    )

    add_heading_2(doc, "5.3. Các chỉ số định lượng cam kết")
    add_bullet_item(
        doc,
        "Loại bỏ 100% nguy cơ deadlock chu trình phụ thuộc trong quá trình lập kế hoạch nhờ thuật toán Kahn.",
        bold_prefix="Tính toàn vẹn logic kế hoạch: "
    )
    add_bullet_item(
        doc,
        "Độ chính xác gợi ý nhân sự (Precision@3) đạt tối thiểu 85% trên bộ dữ liệu đối chuẩn.",
        bold_prefix="Hiệu quả tìm kiếm lai: "
    )
    add_bullet_item(
        doc,
        "Rút ngắn từ 15% đến 25% tổng thời gian hoàn thành dự án (Makespan) so với phương thức lập kế hoạch danh sách phẳng truyền thống.",
        bold_prefix="Tối ưu hóa tiến độ: "
    )
    add_bullet_item(
        doc,
        "Hạ Hệ số mất cân bằng phụ tải Gini xuống dưới 0.25 (mức phân bổ tải rất công bằng, ngăn chặn triệt để tình trạng Senior burnout).",
        bold_prefix="Cân bằng phụ tải: "
    )
    add_bullet_item(
        doc,
        "Giảm tối thiểu 40% - 50% số lượng câu hỏi và gián đoạn công việc gửi tới Senior nhờ danh mục Micro-checklist tự động.",
        bold_prefix="Rút ngắn thời gian kèm cặp: "
    )
    add_bullet_item(
        doc,
        "Thời gian phản hồi truy vấn Hybrid Search và Heuristic dưới 30ms; thời gian tải trang trung bình dưới 1.5 giây; hoàn thành tối thiểu 95% kịch bản kiểm thử chức năng (test cases).",
        bold_prefix="Hiệu năng hệ thống và độ tin cậy: "
    )

    # -------------------------------------------------------------
    # 6. Ý NGHĨA KHOA HỌC VÀ THỰC TIỄN
    # -------------------------------------------------------------
    add_heading_1(doc, "6. Ý nghĩa khoa học và thực tiễn")
    
    add_heading_2(doc, "6.1. Ý nghĩa khoa học (Scientific Significance)")
    add_bullet_item(
        doc,
        "Đề tài tiên phong kết hợp lý thuyết đồ thị (DAG, Kahn, CPM) với các kỹ thuật Trí tuệ nhân tạo hiện đại (LLM, Dense Vector Embeddings) để giải quyết bài toán phân rã kế hoạch dự án phi tuyến tính, thay thế cho cấu trúc phân rã công việc dạng phẳng (Flat WBS) vốn đã bộc lộ nhiều khiếm khuyết trong kỹ nghệ phần mềm đương đại.",
        bold_prefix="Bổ sung và hoàn thiện cơ sở lý thuyết quản trị dự án phi tuyến: "
    )
    add_bullet_item(
        doc,
        "Đề xuất mô hình điều phối nhân lực đa tiêu chí mới: kết hợp phương pháp tìm kiếm lai không tham số (Reciprocal Rank Fusion giữa BM25 và pgvector) với giải thuật Heuristic có phạt tải Gini và hàm thích ứng năng lực Elo. Mô hình này mở ra hướng tiếp cận dữ liệu hóa (Data-driven Workforce Management) mang tính khách quan và khoa học.",
        bold_prefix="Đổi mới phương pháp luận và giải thuật điều phối thích ứng: "
    )
    add_bullet_item(
        doc,
        "Xây dựng bộ dữ liệu mô phỏng chuẩn hóa (100 kỹ sư, 250 tác vụ) cùng khung đánh giá triệt tiêu (Ablation Study Framework) làm tài liệu tham khảo có giá trị cho các nghiên cứu tiếp theo trong lĩnh vực ứng dụng Trí tuệ nhân tạo vào Kỹ nghệ phần mềm (AI for Software Engineering).",
        bold_prefix="Đóng góp tập tư liệu và bộ khung đối chuẩn thực nghiệm: "
    )

    add_heading_2(doc, "6.2. Ý nghĩa thực tiễn (Practical Significance)")
    add_bullet_item(
        doc,
        "Cung cấp một nền tảng làm việc số thông minh giúp Quản lý dự án và Tech Lead tự động hóa khâu phân tích phụ thuộc, giải tỏa áp lực quá tải nhận thức và ngăn chặn triệt để nguy cơ trễ tiến độ dây chuyền.",
        bold_prefix="Giải quyết trực tiếp điểm nghẽn quản trị trong các nhóm phát triển: "
    )
    add_bullet_item(
        doc,
        "Giải thuật Heuristic có tính tải giúp loại bỏ tình trạng phân công cảm tính, ngăn ngừa nguy cơ kiệt sức của kỹ sư chủ chốt, tạo ra môi trường làm việc minh bạch, công bằng và nâng cao mức độ gắn kết của nhân viên.",
        bold_prefix="Bảo vệ nguồn lực nòng cốt và cân bằng tải công bằng: "
    )
    add_bullet_item(
        doc,
        "Cơ chế tự sinh Micro-checklist giúp nhân sự mới (Fresher/Intern) tiếp cận công việc nhanh chóng, tự tin xử lý tác vụ độc lập, giúp tổ chức tiết kiệm ít nhất 40% chi phí và thời gian đào tạo nội bộ.",
        bold_prefix="Tối ưu hóa chi phí đào tạo và thu hẹp khoảng cách kỹ năng: "
    )
    add_bullet_item(
        doc,
        "Hệ thống được thiết kế theo kiến trúc chuẩn mở, đóng gói Docker hoàn chỉnh, có khả năng tích hợp linh hoạt vào quy trình vận hành thực tế của các doanh nghiệp phần mềm vừa và nhỏ (SMEs) tại Việt Nam.",
        bold_prefix="Khả năng chuyển giao công nghệ và nhân rộng thực tế: "
    )

    # -------------------------------------------------------------
    # 7. DỰ KIẾN NỘI DUNG ĐỒ ÁN/KHÓA LUẬN TỐT NGHIỆP
    # -------------------------------------------------------------
    add_heading_1(doc, "7. Dự kiến nội dung đồ án/khóa luận tốt nghiệp")
    
    add_heading_2(doc, "CHƯƠNG 1: TỔNG QUAN VÀ ĐẶT VẤN ĐỀ")
    add_bullet_item(doc, "Bối cảnh phát triển phần mềm hiện đại và sự phức tạp của mô hình quản trị Agile/DevOps.", bold_prefix="1.1. ")
    add_bullet_item(doc, "Thực trạng và những hạn chế cốt lõi của các công cụ quản lý dự án phổ biến (Jira, Trello, Asana).", bold_prefix="1.2. ")
    add_bullet_item(doc, "Phân tích các nút thắt kỹ thuật: Quá tải nhận thức, tắc nghẽn dây chuyền, mất cân bằng phụ tải và gánh nặng kèm cặp nhân sự mới.", bold_prefix="1.3. ")
    add_bullet_item(doc, "Đề xuất giải pháp: Nền tảng không gian làm việc thông minh tích hợp AI hỗ trợ lập kế hoạch DAG và điều phối thích ứng.", bold_prefix="1.4. ")
    add_bullet_item(doc, "Mục tiêu, đối tượng và phạm vi nghiên cứu của đề tài.", bold_prefix="1.5. ")
    add_bullet_item(doc, "Ý nghĩa khoa học, ý nghĩa thực tiễn và bố cục của báo cáo đồ án tốt nghiệp.", bold_prefix="1.6. ")

    add_heading_2(doc, "CHƯƠNG 2: CƠ SỞ LÝ THUYẾT VÀ CÔNG NGHỆ SỬ DỤNG")
    add_bullet_item(doc, "Lý thuyết Đồ thị có hướng không chu trình (DAG) và Kỹ thuật lập lịch trong Kỹ nghệ phần mềm.", bold_prefix="2.1. ")
    add_bullet_item(doc, "Định nghĩa, tính chất của mô hình DAG trong biểu diễn phụ thuộc tác vụ.", bold_prefix="    2.1.1. ")
    add_bullet_item(doc, "Thuật toán Kahn và giải thuật sắp xếp tô-pô kiểm tra chu trình phụ thuộc.", bold_prefix="    2.1.2. ")
    add_bullet_item(doc, "Phương pháp Đường găng (Critical Path Method - CPM) trong xác định thời gian và mốc trọng yếu.", bold_prefix="    2.1.3. ")
    add_bullet_item(doc, "Kỹ thuật Tìm kiếm lai (Hybrid Search) và Thuật toán Hợp nhất Hạng nghịch đảo (RRF).", bold_prefix="2.2. ")
    add_bullet_item(doc, "Mô hình tìm kiếm từ khóa chính xác dựa trên BM25 và Full-text Search.", bold_prefix="    2.2.1. ")
    add_bullet_item(doc, "Mô hình tìm kiếm ngữ nghĩa dựa trên không gian véc-tơ (Dense Vector Embeddings).", bold_prefix="    2.2.2. ")
    add_bullet_item(doc, "Giải thuật Reciprocal Rank Fusion (RRF) trong hợp nhất kết quả tìm kiếm đa nguồn.", bold_prefix="    2.2.3. ")
    add_bullet_item(doc, "Giải thuật Heuristic điều phối có tính tải và Hệ số bất bình đẳng Gini.", bold_prefix="2.3. ")
    add_bullet_item(doc, "Mô hình hóa bài toán gán việc có ràng buộc tải trọng và mức độ khớp kỹ năng.", bold_prefix="    2.3.1. ")
    add_bullet_item(doc, "Giải thuật Heuristic cân bằng phụ tải và tối ưu hóa thời gian hoàn thành (Makespan).", bold_prefix="    2.3.2. ")
    add_bullet_item(doc, "Đo lường mức độ công bằng phụ tải thông qua Hệ số Gini.", bold_prefix="    2.3.3. ")
    add_bullet_item(doc, "Mô hình thích ứng năng lực kỹ sư dựa trên Thuật toán xếp hạng Elo.", bold_prefix="2.4. ")
    add_bullet_item(doc, "Nguyên lý thích ứng năng lực và công thức cập nhật Elo trong nghiệm thu mã nguồn.", bold_prefix="    2.4.1. ")
    add_bullet_item(doc, "Quy trình ánh xạ kết quả Code Review / PR vào trọng số cập nhật điểm.", bold_prefix="    2.4.2. ")
    add_bullet_item(doc, "Ứng dụng Mô hình ngôn ngữ lớn (LLM) trong sinh hướng dẫn vi mô (Micro-checklist).", bold_prefix="2.5. ")
    add_bullet_item(doc, "Khảo sát và lựa chọn công nghệ phát triển hệ thống.", bold_prefix="2.6. ")
    add_bullet_item(doc, "Nền tảng giao diện: Next.js, React, TailwindCSS và React Flow.", bold_prefix="    2.6.1. ")
    add_bullet_item(doc, "Nền tảng dịch vụ backend: Node.js/NestJS (hoặc Python/FastAPI), RESTful API.", bold_prefix="    2.6.2. ")
    add_bullet_item(doc, "Hệ quản trị cơ sở dữ liệu: PostgreSQL và extension pgvector.", bold_prefix="    2.6.3. ")
    add_bullet_item(doc, "Hạ tầng container hóa và môi trường triển khai: Docker, Docker Compose.", bold_prefix="    2.6.4. ")

    add_heading_2(doc, "CHƯƠNG 3: PHÂN TÍCH VÀ THIẾT KẾ HỆ THỐNG")
    add_bullet_item(doc, "Phân tích yêu cầu hệ thống (Yêu cầu chức năng, yêu cầu phi chức năng, biểu đồ ca sử dụng Use Case).", bold_prefix="3.1. ")
    add_bullet_item(doc, "Thiết kế kiến trúc tổng thể hệ thống (Kiến trúc phân tầng Clean Architecture, biểu đồ luồng dữ liệu DFD).", bold_prefix="3.2. ")
    add_bullet_item(doc, "Thiết kế các phân hệ nghiệp vụ cốt lõi:", bold_prefix="3.3. ")
    add_bullet_item(doc, "Phân hệ Lập kế hoạch DAG và phân tích đường găng CPM.", bold_prefix="    3.3.1. ")
    add_bullet_item(doc, "Phân hệ Tìm kiếm lai Hybrid Search RRF và Điều phối Heuristic tính tải.", bold_prefix="    3.3.2. ")
    add_bullet_item(doc, "Phân hệ Tạo sinh Hướng dẫn vi mô (Micro-checklist) thích ứng theo khoảng cách kỹ năng.", bold_prefix="    3.3.3. ")
    add_bullet_item(doc, "Phân hệ Bảng Kanban tương tác và Vòng lặp cập nhật điểm Elo.", bold_prefix="    3.3.4. ")
    add_bullet_item(doc, "Thiết kế cơ sở dữ liệu (Biểu đồ quan hệ thực thể ERD, từ điển dữ liệu, bảng nhúng véc-tơ và chỉ mục HNSW).", bold_prefix="3.4. ")
    add_bullet_item(doc, "Thiết kế giao diện người dùng UI/UX (Canvas tương tác DAG, Bảng Kanban 4 cột, Popup phân công và checklist).", bold_prefix="3.5. ")

    add_heading_2(doc, "CHƯƠNG 4: HIỆN THỰC HÓA VÀ ĐÁNH GIÁ KẾT QUẢ")
    add_bullet_item(doc, "Môi trường cài đặt, cấu hình hệ thống và triển khai dịch vụ.", bold_prefix="4.1. ")
    add_bullet_item(doc, "Hiện thực hóa các phân hệ giao diện tương tác và các luồng chức năng người dùng.", bold_prefix="4.2. ")
    add_bullet_item(doc, "Hiện thực hóa các giải thuật cốt lõi (Thuật toán Kahn, CPM, Hybrid Search RRF, Heuristic Dispatcher, Elo Engine).", bold_prefix="4.3. ")
    add_bullet_item(doc, "Xây dựng kịch bản kiểm thử và bộ dữ liệu mô phỏng chuẩn hóa (Synthetic Benchmark Dataset).", bold_prefix="4.4. ")
    add_bullet_item(doc, "Phân tích kết quả thực nghiệm và nghiên cứu triệt tiêu (Ablation Study):", bold_prefix="4.5. ")
    add_bullet_item(doc, "Đánh giá độ chính xác gợi ý nhân sự (Precision@3, MRR).", bold_prefix="    4.5.1. ")
    add_bullet_item(doc, "Đánh giá thời gian hoàn thành dự án (Makespan) và phát hiện đường găng.", bold_prefix="    4.5.2. ")
    add_bullet_item(doc, "Đánh giá mức độ công bằng phụ tải thông qua Hệ số Gini.", bold_prefix="    4.5.3. ")
    add_bullet_item(doc, "Đánh giá hiệu quả giảm thiểu blocker của Micro-checklist.", bold_prefix="    4.5.4. ")
    add_bullet_item(doc, "Đánh giá hiệu năng kỹ thuật của hệ thống (Độ trễ API, hiệu năng truy vấn vector HNSW, kết quả kiểm thử tự động).", bold_prefix="4.6. ")

    add_heading_2(doc, "CHƯƠNG 5: KẾT LUẬN VÀ HƯỚNG PHÁT TRIỂN")
    add_bullet_item(doc, "Tổng kết các kết quả đạt được của đề tài về mặt lý thuyết và ứng dụng thực tiễn.", bold_prefix="5.1. ")
    add_bullet_item(doc, "Những hạn chế tồn tại của hệ thống và bài học kinh nghiệm rút ra.", bold_prefix="5.2. ")
    add_bullet_item(doc, "Định hướng nghiên cứu và phát triển tiếp theo trong tương lai.", bold_prefix="5.3. ")

    # -------------------------------------------------------------
    # 8. PHÂN CHIA NHIỆM VỤ
    # -------------------------------------------------------------
    add_heading_1(doc, "8. Phân chia nhiệm vụ (đối với đề tài làm nhóm sinh viên)")
    
    add_heading_2(doc, "a) Phần nhiệm vụ chung:")
    tbl_task_gen = doc.add_table(rows=2, cols=3)
    tbl_task_gen.alignment = WD_TABLE_ALIGNMENT.CENTER
    set_table_borders(tbl_task_gen, color="808080", sz="4")
    tbl_task_gen.autofit = False
    col_w_task = [Cm(1.2), Cm(4.8), Cm(10.0)]
    for row in tbl_task_gen.rows:
        for i, w in enumerate(col_w_task):
            row.cells[i].width = w

    headers_gen = ["TT", "Họ tên sinh viên", "Nội dung"]
    for i, h in enumerate(headers_gen):
        cell = tbl_task_gen.cell(0, i)
        set_cell_background(cell, "EAECEE")
        set_cell_margins(cell, top=100, bottom=100, left=100, right=100)
        p = cell.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r = p.add_run(h)
        format_run(r, font_name="Times New Roman", size_pt=12, bold=True)

    row_data_gen = ["1", "Đặng Hồng Nguyên", "Sinh viên thực hiện toàn bộ nội dung đề tài (Đề tài nghiên cứu và phát triển cá nhân)."]
    for i, d in enumerate(row_data_gen):
        cell = tbl_task_gen.cell(1, i)
        set_cell_margins(cell, top=100, bottom=100, left=100, right=100)
        p = cell.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER if i == 0 else WD_ALIGN_PARAGRAPH.LEFT
        r = p.add_run(d)
        format_run(r, font_name="Times New Roman", size_pt=12.5, bold=(i==1))

    add_heading_2(doc, "b) Phần nhiệm vụ cụ thể:")
    tbl_task_spec = doc.add_table(rows=2, cols=3)
    tbl_task_spec.alignment = WD_TABLE_ALIGNMENT.CENTER
    set_table_borders(tbl_task_spec, color="808080", sz="4")
    tbl_task_spec.autofit = False
    for row in tbl_task_spec.rows:
        for i, w in enumerate(col_w_task):
            row.cells[i].width = w

    headers_spec = ["TT", "Họ tên sinh viên", "Nội dung"]
    for i, h in enumerate(headers_spec):
        cell = tbl_task_spec.cell(0, i)
        set_cell_background(cell, "EAECEE")
        set_cell_margins(cell, top=100, bottom=100, left=100, right=100)
        p = cell.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r = p.add_run(h)
        format_run(r, font_name="Times New Roman", size_pt=12, bold=True)

    cell_content_spec = (
        "- Nghiên cứu cơ sở lý thuyết: Mô hình DAG, thuật toán Kahn, phương pháp CPM, Hybrid Search (BM25 + pgvector qua RRF), giải thuật Heuristic tính tải, hệ số Gini và thuật toán Elo.\n"
        "- Khảo sát yêu cầu, thiết kế kiến trúc hệ thống Client - Server, thiết kế CSDL quan hệ kết hợp véc-tơ trên PostgreSQL và thiết kế giao diện UI/UX.\n"
        "- Lập trình phát triển toàn diện hệ thống Smart Workspace: Xây dựng Canvas DAG tương tác trên React Flow, phát triển API backend xử lý giải thuật và truy vấn véc-tơ, tích hợp LLM sinh Micro-checklist, và bảng Kanban cập nhật điểm Elo.\n"
        "- Thiết lập bộ dữ liệu thực nghiệm mô phỏng (100 kỹ sư, 250 tác vụ), thực hiện kiểm thử triệt tiêu (Ablation Study), đo lường các chỉ số Precision@3, Makespan, Gini, và hiệu năng hệ thống.\n"
        "- Viết toàn văn báo cáo thuyết minh đồ án tốt nghiệp, chuẩn bị mã nguồn và hồ sơ bảo vệ trước Hội đồng."
    )
    row_data_spec = ["1", "Đặng Hồng Nguyên", cell_content_spec]
    for i, d in enumerate(row_data_spec):
        cell = tbl_task_spec.cell(1, i)
        set_cell_margins(cell, top=100, bottom=100, left=100, right=100)
        p = cell.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER if i == 0 else WD_ALIGN_PARAGRAPH.LEFT
        r = p.add_run(d)
        format_run(r, font_name="Times New Roman", size_pt=12.5, bold=(i==1))

    # -------------------------------------------------------------
    # 9. DỰ KIẾN TIẾN ĐỘ THỰC HIỆN
    # -------------------------------------------------------------
    add_heading_1(doc, "9. Dự kiến tiến độ thực hiện")
    
    tbl_timeline = doc.add_table(rows=7, cols=3)
    tbl_timeline.alignment = WD_TABLE_ALIGNMENT.CENTER
    set_table_borders(tbl_timeline, color="808080", sz="4")
    tbl_timeline.autofit = False

    time_widths = [Cm(1.2), Cm(4.8), Cm(10.0)]
    for row in tbl_timeline.rows:
        for i, w in enumerate(time_widths):
            row.cells[i].width = w

    headers_time = ["TT", "Thời gian", "Nội dung thực hiện"]
    for i, h in enumerate(headers_time):
        cell = tbl_timeline.cell(0, i)
        set_cell_background(cell, "EAECEE")
        set_cell_margins(cell, top=100, bottom=100, left=100, right=100)
        p = cell.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r = p.add_run(h)
        format_run(r, font_name="Times New Roman", size_pt=12, bold=True)

    timeline_data = [
        ("1", "Từ 01/09/2026\nđến 18/09/2026", "Nhận đề tài, làm việc với giảng viên hướng dẫn ThS. Lương Khánh Tý; thu thập tài liệu khoa học, khảo sát các giải pháp quản lý dự án hiện nay; nghiên cứu cơ sở lý thuyết về mô hình DAG, thuật toán Kahn, CPM, Hybrid Search RRF và thuật toán Elo; hoàn thiện Đề cương chi tiết đồ án tốt nghiệp (thực hiện Chương 1 và Chương 2)."),
        ("2", "Từ 19/09/2026\nđến 10/10/2026", "Phân tích yêu cầu chức năng và phi chức năng; xây dựng sơ đồ ca sử dụng (Use Case), sơ đồ tuần tự (Sequence Diagram); thiết kế kiến trúc hệ thống Client - Server; thiết kế cơ sở dữ liệu quan hệ kết hợp bảng véc-tơ trên PostgreSQL; thiết kế giao diện người dùng UI/UX trên Figma và React Flow Canvas (thực hiện Chương 3)."),
        ("3", "Từ 11/10/2026\nđến 05/11/2026", "Khởi tạo cấu trúc dự án (Monorepo/Docker); thiết lập cơ sở dữ liệu PostgreSQL + pgvector; lập trình phân hệ xác thực, phân quyền; hiện thực hóa Core Engine xử lý mạng lưới DAG (thuật toán Kahn, CPM); xây dựng đường ống Hybrid Search RRF và giải thuật Heuristic điều phối có tính tải."),
        ("4", "Từ 06/11/2026\nđến 25/11/2026", "Lập trình phân hệ tạo sinh Micro-checklist thích ứng tích hợp LLM (Prompt Engineering); xây dựng giao diện tương tác mạng lưới DAG trên React Flow và bảng Kanban kéo thả; lập trình cơ chế cập nhật tự động điểm Elo sau khi nghiệm thu; viết kịch bản kiểm thử (Test cases) và tối ưu hóa hệ thống (thực hiện Chương 4)."),
        ("5", "Từ 26/11/2026\nđến 10/12/2026", "Xây dựng bộ dữ liệu mô phỏng chuẩn hóa (100 kỹ sư, 250 tác vụ); tiến hành thử nghiệm triệt tiêu (Ablation Study); đo lường các chỉ số Precision@3, Makespan, Hệ số Gini và độ trễ truy vấn hệ thống; đóng gói Docker triển khai môi trường thử nghiệm; viết kết luận và định hướng phát triển (thực hiện Chương 5)."),
        ("6", "Từ 11/12/2026\nđến 20/12/2026", "Hoàn thiện toàn văn báo cáo thuyết minh đồ án tốt nghiệp; gửi giảng viên hướng dẫn ThS. Lương Khánh Tý nhận xét, chỉnh sửa và duyệt ký; chuẩn bị slide thuyết trình, kịch bản video demo sản phẩm và hoàn tất hồ sơ bảo vệ đồ án tốt nghiệp trước Hội đồng.")
    ]

    for row_idx, (tt, time_str, content_str) in enumerate(timeline_data, start=1):
        for col_idx, val in enumerate([tt, time_str, content_str]):
            cell = tbl_timeline.cell(row_idx, col_idx)
            set_cell_margins(cell, top=100, bottom=100, left=100, right=100)
            p = cell.paragraphs[0]
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER if col_idx in [0, 1] else WD_ALIGN_PARAGRAPH.JUSTIFY
            r = p.add_run(val)
            format_run(r, font_name="Times New Roman", size_pt=12.5, bold=(col_idx == 0))

    # Spacing
    p_sp_sign = doc.add_paragraph()
    p_sp_sign.paragraph_format.space_before = Pt(14)
    p_sp_sign.paragraph_format.space_after = Pt(4)

    # -------------------------------------------------------------
    # SIGNATURE BLOCK (2 COLUMNS, BORDERLESS)
    # -------------------------------------------------------------
    tbl_sign = doc.add_table(rows=1, cols=2)
    tbl_sign.alignment = WD_TABLE_ALIGNMENT.CENTER
    remove_table_borders(tbl_sign)
    tbl_sign.autofit = False

    sign_widths = [Cm(8.0), Cm(8.0)]
    for row in tbl_sign.rows:
        for i, w in enumerate(sign_widths):
            row.cells[i].width = w

    # Left cell: Supervisor
    c_s_left = tbl_sign.cell(0, 0)
    set_cell_margins(c_s_left, top=60, bottom=60, left=60, right=60)
    p_sl1 = c_s_left.paragraphs[0]
    p_sl1.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_sl1.paragraph_format.space_after = Pt(2)
    r_sl1 = p_sl1.add_run("Người hướng dẫn")
    format_run(r_sl1, font_name="Times New Roman", size_pt=13, bold=True)

    p_sl2 = c_s_left.add_paragraph()
    p_sl2.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_sl2.paragraph_format.space_after = Pt(50)  # Space for signature
    r_sl2 = p_sl2.add_run("(ký và ghi rõ họ tên)")
    format_run(r_sl2, font_name="Times New Roman", size_pt=12, italic=True)

    p_sl3 = c_s_left.add_paragraph()
    p_sl3.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_sl3.paragraph_format.space_after = Pt(0)
    r_sl3 = p_sl3.add_run("ThS. Lương Khánh Tý")
    format_run(r_sl3, font_name="Times New Roman", size_pt=13, bold=True)

    # Right cell: Student with date
    c_s_right = tbl_sign.cell(0, 1)
    set_cell_margins(c_s_right, top=60, bottom=60, left=60, right=60)
    p_sr0 = c_s_right.paragraphs[0]
    p_sr0.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_sr0.paragraph_format.space_after = Pt(2)
    r_sr0 = p_sr0.add_run("Đà Nẵng, ngày 28 tháng 9 năm 2026")
    format_run(r_sr0, font_name="Times New Roman", size_pt=12.5, italic=True)

    p_sr1 = c_s_right.add_paragraph()
    p_sr1.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_sr1.paragraph_format.space_after = Pt(2)
    r_sr1 = p_sr1.add_run("Sinh viên thực hiện")
    format_run(r_sr1, font_name="Times New Roman", size_pt=13, bold=True)

    p_sr2 = c_s_right.add_paragraph()
    p_sr2.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_sr2.paragraph_format.space_after = Pt(50)  # Space for signature
    r_sr2 = p_sr2.add_run("(ký và ghi rõ họ tên)")
    format_run(r_sr2, font_name="Times New Roman", size_pt=12, italic=True)

    p_sr3 = c_s_right.add_paragraph()
    p_sr3.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_sr3.paragraph_format.space_after = Pt(0)
    r_sr3 = p_sr3.add_run("Đặng Hồng Nguyên")
    format_run(r_sr3, font_name="Times New Roman", size_pt=13, bold=True)

    # Faculty / Department confirmation below
    p_dept_sp = doc.add_paragraph()
    p_dept_sp.paragraph_format.space_before = Pt(20)
    p_dept_sp.paragraph_format.space_after = Pt(2)
    p_dept_sp.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r_dept1 = p_dept_sp.add_run("Khoa/Bộ môn duyệt\n")
    format_run(r_dept1, font_name="Times New Roman", size_pt=13, bold=True)
    r_dept2 = p_dept_sp.add_run("(ký và ghi rõ họ tên)")
    format_run(r_dept2, font_name="Times New Roman", size_pt=12, italic=True)

    # Output file
    output_path = "DeCuongChiTiet_DoAnTotNghiep_DangHongNguyen.docx"
    doc.save(output_path)
    print(f"Document successfully created at: {output_path}")

if __name__ == "__main__":
    build_document()
