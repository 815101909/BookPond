Component({
  properties: {
    show: {
      type: Boolean,
      value: false
    },
    title: {
      type: String,
      value: ''
    },
    content: {
      type: String,
      value: ''
    },
    confirmText: {
      type: String,
      value: '确定'
    }
  },

  methods: {
    onConfirm() {
      this.triggerEvent('confirm');
    }
  }
}); 