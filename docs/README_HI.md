[English · canonical documentation](../README.md)

# vibecosystem — हिन्दी

**Claude Code के लिए केंद्रित रनटाइम और Codex के लिए सीमित दायरे वाला worker।**

डिफ़ॉल्ट `core` प्रोफ़ाइल जाँच, कार्यान्वयन, समीक्षा और सत्यापन के लिए चुने हुए घटक स्थापित करती है। मेमोरी, लर्निंग और कई एजेंटों का समन्वय अलग विकल्प हैं; पूरा कैटलॉग स्थापित करने से एजेंट समूह अपने आप शुरू नहीं होता।

यह पेज परिचय है। नवीनतम तकनीकी निर्देश, निर्भरताएँ और सीमाएँ अंग्रेज़ी README में हैं।

![Runtime profiles](../assets/runtime-overview.svg)

## त्वरित शुरुआत

```bash
git clone https://github.com/vibeeval/vibecosystem.git
cd vibecosystem
./install.sh --profile core --dry-run
./install.sh --profile core
vibeco effective-config
```

इस सोर्स ट्री में 3.5.0 तैयार किया जा रहा है; इसका अर्थ npm या GitHub पर प्रकाशित होना नहीं है। संदर्भ सीमाएँ अक्षरों में हैं और मॉडल के कुल टोकन उपयोग को सीमित नहीं करतीं। निश्चित प्रतिशत टोकन बचत का वादा नहीं है।

[Profiles and setup](../README.md#profiles) · [Codex](codex-setup.md) · [Upgrade guide](../UPGRADING.md) · [Security](../SECURITY.md) · [Verification](verification.md)
