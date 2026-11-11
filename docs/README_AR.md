[English · canonical documentation](../README.md)

# vibecosystem — العربية

**بيئة مركزة لـ Claude Code وworker محدود النطاق لـ Codex.**

يثبّت ملف `core` الافتراضي مكونات مختارة للتحليل والتنفيذ والمراجعة والتحقق. الذاكرة والتعلم وتنسيق عدة وكلاء خيارات منفصلة؛ تثبيت الكتالوج الكامل لا يبدأ سرب وكلاء تلقائياً.

هذه الصفحة مقدمة مختصرة. التعليمات التقنية المحدثة والتبعيات والقيود موجودة في README الإنجليزي.

![Runtime profiles](../assets/runtime-overview.svg)

## البدء السريع

```bash
git clone https://github.com/vibeeval/vibecosystem.git
cd vibecosystem
./install.sh --profile core --dry-run
./install.sh --profile core
```

الملف الشخصي الافتراضي هو `core`؛ بدّل الملف الشخصي بـ:

```bash
vibeco profile quality
vibeco profile core
vibeco profile memory
vibeco profile full
```

`vibeco effective-config` يعرض الملف الشخصي النشط وعدد الـ hooks المسجّلة.

الإصدار 3.5.0 هو الإصدار الحالي المنشور على npm. حدود السياق تُحسب بالأحرف ولا تحد استهلاك النموذج الكامل. لا نعد بنسبة ثابتة لتوفير التوكنات.

[Profiles and setup](../README.md#profiles) · [Codex](codex-setup.md) · [Upgrade guide](../UPGRADING.md) · [Security](../SECURITY.md) · [Verification](verification.md)
